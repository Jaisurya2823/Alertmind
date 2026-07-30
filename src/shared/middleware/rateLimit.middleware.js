/**
 * AlertMind — Rate Limiter Middleware Factory
 * Creates Redis-backed rate limiters for specific endpoint groups.
 */

import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../config/redis.config.js';
import { RATE_LIMIT_PREFIX } from '../constants/security.constants.js';
import { HTTP_STATUS } from '../constants/app.constants.js';

/**
 * Creates a Redis-backed rate limiter middleware.
 * @param {object} options
 * @param {string} options.prefix - Redis key prefix
 * @param {number} options.windowMs
 * @param {number} options.max
 * @param {string} [options.message]
 * @param {(req: import('express').Request) => string} [options.keyGenerator]
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({ prefix, windowMs, max, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.user?.id || req.ip),
    store: new RedisStore({
      sendCommand: (...args) => getRedisClient().call(...args),
      prefix: `${prefix}:`,
    }),
    handler: (_req, res) => {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: message || 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
}

// ─── Pre-built limiters ─────────────────────────────────────────────────────

/**
 * Strict rate limiter for authentication endpoints (10 req / 15 min per IP).
 */
export const authRateLimiter = createRateLimiter({
  prefix: RATE_LIMIT_PREFIX.AUTH,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => req.ip,
});

/**
 * AI analysis rate limiter (10 req / 60s per user).
 */
export const aiRateLimiter = (config) => createRateLimiter({
  prefix: RATE_LIMIT_PREFIX.AI,
  windowMs: config.AI_RATE_LIMIT_WINDOW_MS,
  max: config.AI_RATE_LIMIT_MAX_REQUESTS,
  message: 'AI analysis rate limit exceeded. Please wait before submitting another alert.',
});

/**
 * Export rate limiter (5 PDF req / 60s per user).
 */
export const exportRateLimiter = createRateLimiter({
  prefix: RATE_LIMIT_PREFIX.EXPORT,
  windowMs: 60_000,
  max: 5,
  message: 'Export rate limit exceeded. Maximum 5 exports per minute.',
});
