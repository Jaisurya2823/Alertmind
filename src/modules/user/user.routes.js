/**
 * AlertMind — Auth & User Routes
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../config/redis.config.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { requireAuth } from './auth.middleware.js';
import { RATE_LIMIT_PREFIX } from '../../shared/constants/security.constants.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} from './user.schema.js';
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  getMeHandler,
  changePasswordHandler,
  updateProfileHandler,
} from './user.controller.js';

const router = Router();

// Strict rate limit for auth endpoints — prevents brute force
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyGenerator: (req) => req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: RATE_LIMIT_PREFIX.AUTH,
  }),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    });
  },
});

// ─── Public routes ───────────────────────────────────────────────────────────
router.post('/register', authRateLimiter, validate({ body: registerSchema }), registerHandler);
router.post('/login', authRateLimiter, validate({ body: loginSchema }), loginHandler);

// ─── Protected routes ────────────────────────────────────────────────────────
router.post('/logout', requireAuth, logoutHandler);
router.get('/me', requireAuth, getMeHandler);
router.patch('/me', requireAuth, validate({ body: updateProfileSchema }), updateProfileHandler);
router.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), changePasswordHandler);

export default router;
