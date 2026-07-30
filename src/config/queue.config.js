/**
 * AlertMind — Queue Configuration
 * BullMQ default job options and worker settings.
 */

import { getConfig } from './env.js';

const env = getConfig();

export const queueConfig = Object.freeze({
  concurrency: env.QUEUE_CONCURRENCY,
  jobTimeoutMs: env.QUEUE_JOB_TIMEOUT_MS,

  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },

  workerOptions: {
    maxStalledCount: 3,
    stalledInterval: 30_000,
  },
});

export default queueConfig;
