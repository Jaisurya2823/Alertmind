/**
 * AlertMind — BullMQ Queue Setup
 * Each queue has its own ioredis connection (BullMQ requirement).
 * Workers defined here; job processors imported from jobs.js.
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.config.js';
import { getConfig } from '../../config/env.js';
import logger from '../logger/logger.js';
import { queueJobDuration, queueJobTotal, queueDepth } from '../metrics/metrics.js';
import { processInvestigationJob, processConnectorSyncJob } from './jobs.js';

const config = getConfig();

// ─── Queue Names ─────────────────────────────────────────────────────────────
export const QUEUE_NAMES = Object.freeze({
  INVESTIGATION: 'investigation',
  REPORT_EXPORT: 'report-export',
  NOTIFICATION: 'notification',
  CONNECTOR_SYNC: 'connector-sync',
});

/** @type {Map<string, Queue>} */
const queues = new Map();

/** @type {Map<string, Worker>} */
const workers = new Map();

/** @type {Map<string, QueueEvents>} */
const queueEvents = new Map();

// ─── Queue Default Options ────────────────────────────────────────────────────
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 1000, // Keep last 1000 completed jobs for debugging
    age: 86400, // Keep for 24 hours
  },
  removeOnFail: {
    count: 5000, // Keep last 5000 failed jobs
    age: 604800, // Keep for 7 days
  },
};

/**
 * Creates a BullMQ Queue with its own Redis connection.
 * @param {string} name
 * @returns {Queue}
 */
function createQueue(name) {
  const connection = createBullMQConnection();
  const queue = new Queue(name, {
    connection,
    defaultJobOptions,
  });

  queue.on('error', (err) => logger.error({ err, queue: name }, 'Queue error'));

  return queue;
}

/**
 * Creates a BullMQ Worker with metrics instrumentation.
 * @param {string} name
 * @param {Function} processor
 * @param {number} concurrency
 * @returns {Worker}
 */
function createWorker(name, processor, concurrency = config.QUEUE_CONCURRENCY) {
  const connection = createBullMQConnection();

  const worker = new Worker(name, async (job) => {
    const startTime = Date.now();
    logger.info({ queue: name, jobId: job.id, jobName: job.name }, 'Job started');

    try {
      const result = await processor(job);
      const duration = (Date.now() - startTime) / 1000;

      queueJobDuration.observe({ queue: name, job_name: job.name, status: 'completed' }, duration);
      queueJobTotal.inc({ queue: name, job_name: job.name, status: 'completed' });

      logger.info(
        { queue: name, jobId: job.id, duration: `${duration.toFixed(2)}s` },
        'Job completed'
      );

      return result;
    } catch (err) {
      const duration = (Date.now() - startTime) / 1000;

      queueJobDuration.observe({ queue: name, job_name: job.name, status: 'failed' }, duration);
      queueJobTotal.inc({ queue: name, job_name: job.name, status: 'failed' });

      logger.error({ err, queue: name, jobId: job.id, jobName: job.name }, 'Job failed');
      throw err;
    }
  }, {
    connection,
    concurrency,
    maxStalledCount: 3,
    stalledInterval: 30_000,
    lockDuration: config.QUEUE_JOB_TIMEOUT_MS,
  });

  worker.on('error', (err) => logger.error({ err, queue: name }, 'Worker error'));
  worker.on('stalled', (jobId) => logger.warn({ jobId, queue: name }, 'Job stalled'));
  worker.on('failed', (job, err) =>
    logger.error({ err, jobId: job?.id, attempts: job?.attemptsMade }, 'Job permanently failed')
  );

  return worker;
}

/**
 * Starts all queue workers.
 * Called during server bootstrap.
 */
export async function startQueueWorkers() {
  // ─── Investigation Queue ────────────────────────────────────────────────
  const investigationQueue = createQueue(QUEUE_NAMES.INVESTIGATION);
  const investigationWorker = createWorker(
    QUEUE_NAMES.INVESTIGATION,
    processInvestigationJob,
    config.QUEUE_CONCURRENCY
  );
  const investigationEvents = new QueueEvents(QUEUE_NAMES.INVESTIGATION, {
    connection: createBullMQConnection(),
  });

  queues.set(QUEUE_NAMES.INVESTIGATION, investigationQueue);
  workers.set(QUEUE_NAMES.INVESTIGATION, investigationWorker);
  queueEvents.set(QUEUE_NAMES.INVESTIGATION, investigationEvents);

  // ─── Connector Sync Queue ───────────────────────────────────────────────
  // Lower concurrency: sync jobs hold open connections to customer infra
  const connectorSyncQueue = createQueue(QUEUE_NAMES.CONNECTOR_SYNC);
  const connectorSyncWorker = createWorker(
    QUEUE_NAMES.CONNECTOR_SYNC,
    processConnectorSyncJob,
    2
  );

  queues.set(QUEUE_NAMES.CONNECTOR_SYNC, connectorSyncQueue);
  workers.set(QUEUE_NAMES.CONNECTOR_SYNC, connectorSyncWorker);

  logger.info({ queues: [...queues.keys()] }, 'Queue workers started');
}

/**
 * Gracefully stops all workers (finishes current jobs).
 */
export async function stopQueueWorkers() {
  await Promise.all([...workers.values()].map((w) => w.close()));
  await Promise.all([...queueEvents.values()].map((e) => e.close()));
  await Promise.all([...queues.values()].map((q) => q.close()));

  workers.clear();
  queueEvents.clear();
  queues.clear();
}

/**
 * Returns a queue by name for adding jobs.
 * @param {string} name
 * @returns {Queue}
 */
export function getQueue(name) {
  const queue = queues.get(name);
  if (!queue) throw new Error(`Queue '${name}' not initialized`);
  return queue;
}

/**
 * Adds an investigation job to the queue.
 * @param {string} investigationId
 * @param {string} alertId
 * @param {string} rawInput
 * @returns {Promise<string>} job ID
 */
export async function enqueueInvestigation(investigationId, alertId, rawInput) {
  const queue = getQueue(QUEUE_NAMES.INVESTIGATION);
  const job = await queue.add(
    'analyze',
    { investigationId, alertId, rawInput },
    {
      jobId: investigationId, // Idempotent — same investigation ID = same job
      priority: 1,
      timeout: config.QUEUE_JOB_TIMEOUT_MS,
    }
  );
  return job.id;
}

/**
 * Schedules a recurring connector sync using BullMQ's repeatable job feature.
 * BullMQ deduplicates repeatable jobs by their key across all replicas —
 * this means the sync fires once per interval cluster-wide, not once per pod.
 *
 * @param {string} connectorId
 * @param {number} intervalMinutes
 */
export async function scheduleConnectorSync(connectorId, intervalMinutes) {
  const queue = getQueue(QUEUE_NAMES.CONNECTOR_SYNC);

  // Remove any existing schedule for this connector first (handles interval changes)
  await unscheduleConnectorSync(connectorId);

  await queue.add(
    'sync',
    { connectorId },
    {
      jobId: `sync-${connectorId}`,
      repeat: { every: intervalMinutes * 60 * 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    }
  );

  logger.info({ connectorId, intervalMinutes }, 'Connector sync scheduled');
}

/**
 * Removes the recurring sync schedule for a connector.
 * Called when a connector is disabled or deleted.
 * @param {string} connectorId
 */
export async function unscheduleConnectorSync(connectorId) {
  const queue = getQueue(QUEUE_NAMES.CONNECTOR_SYNC);
  const repeatableJobs = await queue.getRepeatableJobs();

  const existing = repeatableJobs.filter((j) => j.id === `sync-${connectorId}`);
  await Promise.all(existing.map((j) => queue.removeRepeatableByKey(j.key)));
}

/**
 * Enqueues an immediate one-off connector sync (manual "Sync Now" trigger).
 * @param {string} connectorId
 * @returns {Promise<string>} job ID
 */
export async function enqueueConnectorSyncNow(connectorId) {
  const queue = getQueue(QUEUE_NAMES.CONNECTOR_SYNC);
  const job = await queue.add(
    'sync-manual',
    { connectorId },
    { priority: 1 }
  );
  return job.id;
}
