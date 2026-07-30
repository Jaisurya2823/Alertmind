/**
 * AlertMind — Vitest Global Test Setup
 * Runs once before all tests. Sets up test environment variables.
 * Unit and integration tests use real instances (not mocks) per production rules.
 */

import { beforeAll, afterAll } from 'vitest';

// ─── Test environment variables ───────────────────────────────────────────────
// These must be set before any module imports resolve
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.APP_URL = 'http://localhost:3001';
process.env.CORS_ORIGINS = 'http://localhost:3001';

// Test database — separate DB from development to prevent data pollution
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://alertmind:alertmind_dev_password@localhost:5432/alertmind_test?schema=public';

// Redis — use a separate Redis DB (DB 1 for test, DB 0 for dev)
process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = process.env.TEST_REDIS_PASSWORD || '';
process.env.REDIS_TLS = 'false';

// Groq — use real API in integration tests; unit tests mock at LLM layer
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'gsk_test_placeholder';
process.env.GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile';
process.env.GROQ_FAST_MODEL = 'llama-3.1-8b-instant';
process.env.GROQ_MAX_TOKENS = '4096';
process.env.GROQ_TEMPERATURE = '0.1';

// Auth — test keys (DO NOT USE IN PRODUCTION)
process.env.AUTH_SECRET = 'test_auth_secret_minimum_64_characters_long_for_validation_purposes_test';
process.env.CSRF_SECRET = 'test_csrf_secret_minimum_64_characters_long_for_validation_purposes_test';
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// Use test RSA keys (2048-bit — weaker than production 4096-bit but sufficient for tests)
process.env.JWT_PRIVATE_KEY = process.env.TEST_JWT_PRIVATE_KEY
  || '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Z3VS5JJcds3xHn/ygWep4VJ\n...\n-----END RSA PRIVATE KEY-----';
process.env.JWT_PUBLIC_KEY = process.env.TEST_JWT_PUBLIC_KEY
  || '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC\n...\n-----END PUBLIC KEY-----';

// MinIO — test bucket
process.env.MINIO_ENDPOINT = process.env.TEST_MINIO_ENDPOINT || 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'alertmind_access';
process.env.MINIO_SECRET_KEY = 'alertmind_secret_dev';
process.env.MINIO_BUCKET = 'alertmind-test';
process.env.MINIO_USE_SSL = 'false';

// Disable Sentry in tests
process.env.SENTRY_DSN = '';

// Metrics — disabled in tests
process.env.METRICS_ENABLED = 'false';
process.env.METRICS_PORT = '9091';

// Rate limiting — disabled in tests
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
process.env.AI_RATE_LIMIT_MAX_REQUESTS = '10000';

// Puppeteer
process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

// Queue
process.env.QUEUE_CONCURRENCY = '1';
process.env.QUEUE_JOB_TIMEOUT_MS = '30000';

console.log('[Test Setup] Environment configured for test mode');
