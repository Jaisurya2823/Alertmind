/**
 * AlertMind — AI Configuration
 * Groq model settings derived from validated environment variables.
 */

import { getConfig } from './env.js';
import { GROQ_MODELS } from '../shared/constants/ai.constants.js';

const env = getConfig();

export const aiConfig = Object.freeze({
  groq: {
    apiKey: env.GROQ_API_KEY,
    primaryModel: env.GROQ_PRIMARY_MODEL,
    fastModel: env.GROQ_FAST_MODEL,
    maxTokens: env.GROQ_MAX_TOKENS,
    temperature: env.GROQ_TEMPERATURE,
  },
  models: GROQ_MODELS,
  pipeline: {
    queueConcurrency: env.QUEUE_CONCURRENCY,
    jobTimeoutMs: env.QUEUE_JOB_TIMEOUT_MS,
  },
});

export default aiConfig;
