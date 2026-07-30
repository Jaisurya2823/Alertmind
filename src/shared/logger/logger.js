/**
 * AlertMind — Logger (Pino)
 * Production structured logging with security-sensitive field redaction
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  name: 'alertmind',
  level: isTest ? 'silent' : isDevelopment ? 'debug' : 'info',

  // ─── Redact sensitive fields ─────────────────────────────────────────────
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.body.password',
      'req.body.passwordHash',
      'mfaSecret',
      'configEncrypted',
      'keyHash',
      'GROQ_API_KEY',
      'AUTH_SECRET',
      'CSRF_SECRET',
      'ENCRYPTION_KEY',
    ],
    censor: '[REDACTED]',
  },

  // ─── Custom serializers ──────────────────────────────────────────────────
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // ─── Development: pretty print ───────────────────────────────────────────
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),

  // ─── Base fields on every log line ──────────────────────────────────────
  base: {
    service: 'alertmind',
    env: process.env.NODE_ENV,
    pid: process.pid,
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
