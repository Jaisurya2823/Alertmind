/**
 * AlertMind — Request Logger Middleware
 * Structured HTTP request/response logging with pino-http.
 * Redacts sensitive headers; skips health check noise.
 */

import { pinoHttp } from 'pino-http';
import logger from './logger.js';

export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'silent';
    return 'info';
  },
  customProps: (req) => ({
    requestId: req.id,
    realIp: req.realIp || req.ip,
  }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
    ],
    censor: '[REDACTED]',
  },
  autoLogging: {
    ignore: (req) =>
      req.url === '/api/health' ||
      req.url === '/api/health/live' ||
      req.url === '/api/health/ready',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
