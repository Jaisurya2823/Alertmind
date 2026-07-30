/**
 * AlertMind — Queue Job Processors
 * Each function is a BullMQ job processor called by queue.js workers.
 * Job processors must be idempotent — safe to retry on failure.
 */

import { runInvestigationPipeline } from '../../modules/ai/orchestration.service.js';
import logger from '../logger/logger.js';

/**
 * Processes an investigation job from the 'investigation' queue.
 * Idempotent: if investigation already COMPLETED, skips re-processing.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ investigationId: string, status: string }>}
 */
export async function processInvestigationJob(job) {
  const { investigationId, alertId, rawInput } = job.data;

  if (!investigationId || !alertId || !rawInput) {
    throw new Error(
      `Investigation job ${job.id} missing required fields: investigationId=${investigationId}, alertId=${alertId}`
    );
  }

  logger.info(
    { jobId: job.id, investigationId, alertId },
    'Processing investigation job'
  );

  // Update job progress for monitoring
  await job.updateProgress(5);

  await runInvestigationPipeline({
    investigationId,
    alertId,
    rawInput,
  });

  await job.updateProgress(100);

  return { investigationId, status: 'COMPLETED' };
}

/**
 * Processes a connector sync job from the 'connector-sync' queue.
 *
 * NOTE: uses a dynamic import for connector.service.js. connector.service.js
 * imports scheduleConnectorSync/unscheduleConnectorSync from queue.js, which
 * imports this file — a static top-level import here would create a circular
 * module dependency. The dynamic import defers resolution until the job
 * actually runs, after the full module graph has finished loading.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ connectorId: string, ingested: number }>}
 */
export async function processConnectorSyncJob(job) {
  const { connectorId } = job.data;

  if (!connectorId) {
    throw new Error(`Connector sync job ${job.id} missing connectorId`);
  }

  logger.info({ jobId: job.id, connectorId }, 'Processing connector sync job');

  const { runConnectorSync } = await import('../../modules/connector/connector.service.js');
  const result = await runConnectorSync(connectorId);

  return { connectorId, ingested: result.ingested };
}
