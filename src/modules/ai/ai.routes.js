/**
 * AlertMind — AI Routes
 * Direct AI pipeline interaction endpoints.
 * Primary investigation flow goes through /api/v1/alerts → BullMQ → orchestration.
 * These endpoints expose pipeline internals for debugging and direct API access.
 */

import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../config/redis.config.js';
import { getConfig } from '../../config/env.js';
import { requireAuth } from '../user/auth.middleware.js';
import { requirePermission } from '../user/permission.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { PERMISSION, RATE_LIMIT_PREFIX } from '../../shared/constants/security.constants.js';
import { ok } from '../../shared/http/response.js';
import { GROQ_MODELS, PIPELINE_STAGES } from '../../shared/constants/ai.constants.js';

const router = Router();
const config = getConfig();

// AI endpoints rate limit — same as alert submission
const aiRateLimiter = rateLimit({
  windowMs: config.AI_RATE_LIMIT_WINDOW_MS,
  max: config.AI_RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: (req) => req.user?.id || req.ip,
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: RATE_LIMIT_PREFIX.AI,
  }),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'AI rate limit exceeded',
      code: 'AI_RATE_LIMIT_EXCEEDED',
    });
  },
});

router.use(requireAuth);

/**
 * GET /api/v1/ai/info
 * Returns current AI model configuration
 */
router.get('/info', (req, res) => {
  return ok(res, {
    primaryModel: config.GROQ_PRIMARY_MODEL,
    fastModel: config.GROQ_FAST_MODEL,
    maxTokens: config.GROQ_MAX_TOKENS,
    temperature: config.GROQ_TEMPERATURE,
    pipelineStages: PIPELINE_STAGES,
    availableModels: Object.values(GROQ_MODELS),
  });
});

/**
 * GET /api/v1/ai/pipeline/stages
 * Returns the ordered list of pipeline stages
 */
router.get('/pipeline/stages', requirePermission(PERMISSION.INVESTIGATION_READ), (req, res) => {
  return ok(res, {
    stages: PIPELINE_STAGES,
    count: PIPELINE_STAGES.length,
    description: 'AI investigation pipeline stage order',
  });
});

export default router;
