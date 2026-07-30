/**
 * AlertMind — Logger Configuration
 * Centralizes Pino log level and transport settings.
 */

import { getConfig } from './env.js';

const env = getConfig();

export const loggerConfig = Object.freeze({
  level: env.NODE_ENV === 'test'
    ? 'silent'
    : env.NODE_ENV === 'development'
      ? 'debug'
      : 'info',
  prettyPrint: env.NODE_ENV === 'development',
  // Fields always redacted from logs
  redactPaths: [
    'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
    'authorization', 'req.headers.authorization', 'req.headers["x-api-key"]',
    'req.body.password', 'mfaSecret', 'configEncrypted', 'keyHash',
  ],
});

export default loggerConfig;
