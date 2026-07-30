/**
 * AlertMind — Application Configuration
 * Derived application settings built on top of raw env vars.
 */

import { getConfig } from './env.js';

const env = getConfig();

export const appConfig = Object.freeze({
  name: 'AlertMind',
  version: process.env.npm_package_version || '1.0.0',
  env: env.NODE_ENV,
  port: env.PORT,
  url: env.APP_URL,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  maxFileSizeMb: env.MAX_FILE_SIZE_MB,
  maxFileSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
});

export default appConfig;
