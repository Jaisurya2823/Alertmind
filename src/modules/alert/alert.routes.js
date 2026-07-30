/**
 * AlertMind — Alert Routes
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../config/redis.config.js';
import { getConfig } from '../../config/env.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { uploadAlertFileMiddleware } from '../../shared/middleware/upload.middleware.js';
import { requireAuth } from '../user/auth.middleware.js';
import { requirePermission } from '../user/permission.middleware.js';
import { PERMISSION, RATE_LIMIT_PREFIX } from '../../shared/constants/security.constants.js';
import {
  submitAlertBodySchema,
  uploadAlertBodySchema,
  listAlertsQuerySchema,
  alertIdParamSchema,
} from './alert.schema.js';
import {
  submitAlertHandler,
  uploadAlertHandler,
  getAlertHandler,
  listAlertsHandler,
  archiveAlertHandler,
} from './alert.controller.js';

const router = Router();
const config = getConfig();

// AI analysis rate limiter — more restrictive than global
// Prevents cost abuse from rapid-fire submissions
const aiRateLimiter = rateLimit({
  windowMs: config.AI_RATE_LIMIT_WINDOW_MS,
  max: config.AI_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id || req.ip}`,
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: RATE_LIMIT_PREFIX.AI,
  }),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: `AI analysis rate limit exceeded. Maximum ${config.AI_RATE_LIMIT_MAX_REQUESTS} investigations per ${config.AI_RATE_LIMIT_WINDOW_MS / 1000}s.`,
      code: 'AI_RATE_LIMIT_EXCEEDED',
    });
  },
});

// All alert routes require authentication
router.use(requireAuth);

// ─── Submit alert (text/JSON paste) ─────────────────────────────────────────
router.post(
  '/',
  requirePermission(PERMISSION.ALERT_WRITE),
  aiRateLimiter,
  validate({ body: submitAlertBodySchema }),
  submitAlertHandler
);

// ─── Submit alert (file upload) ──────────────────────────────────────────────
router.post(
  '/upload',
  requirePermission(PERMISSION.ALERT_WRITE),
  aiRateLimiter,
  uploadAlertFileMiddleware,
  validate({ body: uploadAlertBodySchema }),
  uploadAlertHandler
);

// ─── List alerts ─────────────────────────────────────────────────────────────
router.get(
  '/',
  requirePermission(PERMISSION.ALERT_READ),
  validate({ query: listAlertsQuerySchema }),
  listAlertsHandler
);

// ─── Get single alert ────────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermission(PERMISSION.ALERT_READ),
  validate({ params: alertIdParamSchema }),
  getAlertHandler
);

// ─── Archive alert ───────────────────────────────────────────────────────────
router.delete(
  '/:id',
  requirePermission(PERMISSION.ALERT_DELETE),
  validate({ params: alertIdParamSchema }),
  archiveAlertHandler
);

export default router;
