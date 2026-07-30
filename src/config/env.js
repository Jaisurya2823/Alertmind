/**
 * AlertMind — Environment Configuration
 * Zod schema validation — fail-fast on missing or invalid env vars
 * All config consumed through this module — no direct process.env elsewhere
 */

import { z } from 'zod';

const envSchema = z.object({
  // ─── App ────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_URL: z.string().url(),
  CORS_ORIGINS: z.string().min(1),

  // ─── Database ───────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url().refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    { message: 'DATABASE_URL must start with postgresql:// or postgres://' }
  ),

  // ─── Redis ──────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),

  // ─── AI — Groq ──────────────────────────────────────────────────────────
  GROQ_API_KEY: z.string().min(1).startsWith('gsk_'),
  GROQ_PRIMARY_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_FAST_MODEL: z.string().default('llama-3.1-8b-instant'),
  GROQ_MAX_TOKENS: z.coerce.number().int().min(256).max(32768).default(8192),
  // Low temperature enforced for security analysis (determinism over creativity)
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(0.3).default(0.1),

  // ─── Authentication ─────────────────────────────────────────────────────
  AUTH_SECRET: z.string().min(64),
  JWT_PRIVATE_KEY: z.string().includes('-----BEGIN'),
  JWT_PUBLIC_KEY: z.string().includes('-----BEGIN'),

  // ─── CSRF ───────────────────────────────────────────────────────────────
  CSRF_SECRET: z.string().min(64),

  // ─── MinIO ──────────────────────────────────────────────────────────────
  // ─── Storage ────────────────────────────────────────────────────────────
  // 'local' (default) writes to disk — no external service, no Docker needed.
  // 'minio' requires the MINIO_* variables below (enforced by superRefine).
  STORAGE_PROVIDER: z.enum(['local', 'minio']).default('local'),
  STORAGE_LOCAL_PATH: z.string().min(1).default('./storage/objects'),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().min(1).default('alertmind'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  // ─── Encryption (for connector credentials at rest) ─────────────────────
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes as hex = 64 chars

  // ─── Sentry ─────────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // ─── OpenTelemetry ──────────────────────────────────────────────────────
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal('')),
  OTEL_SERVICE_NAME: z.string().default('alertmind'),
  OTEL_SERVICE_VERSION: z.string().default('1.0.0'),

  // ─── Rate Limiting ──────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  AI_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(10),

  // ─── File Upload ────────────────────────────────────────────────────────
  MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).max(50).default(10),

  // ─── Puppeteer ──────────────────────────────────────────────────────────
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: z.coerce.boolean().default(true),

  // ─── Queue ──────────────────────────────────────────────────────────────
  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  QUEUE_JOB_TIMEOUT_MS: z.coerce.number().int().default(120_000),

  // ─── Session ────────────────────────────────────────────────────────────
  SESSION_EXPIRY_SECONDS: z.coerce.number().int().default(86400),

  // ─── Metrics ────────────────────────────────────────────────────────────
  METRICS_PORT: z.coerce.number().int().default(9090),
  METRICS_ENABLED: z.coerce.boolean().default(true),
}).superRefine((data, ctx) => {
  // MinIO fields are optional by default (local storage doesn't need them),
  // but become required the moment someone opts into STORAGE_PROVIDER=minio.
  if (data.STORAGE_PROVIDER === 'minio') {
    if (!data.MINIO_ENDPOINT) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MINIO_ENDPOINT'], message: 'Required when STORAGE_PROVIDER=minio' });
    }
    if (!data.MINIO_ACCESS_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MINIO_ACCESS_KEY'], message: 'Required when STORAGE_PROVIDER=minio' });
    }
    if (!data.MINIO_SECRET_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MINIO_SECRET_KEY'], message: 'Required when STORAGE_PROVIDER=minio' });
    }
  }
});

/** @type {z.infer<typeof envSchema> | null} */
let _config = null;

/**
 * Returns validated, type-safe environment configuration.
 * Parses once and caches; exits process on validation failure.
 * @returns {z.infer<typeof envSchema>}
 */
export function getConfig() {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten();
    // Use console.error here — logger may not be initialized yet
    console.error('═══════════════════════════════════════════════');
    console.error('FATAL: Invalid environment configuration');
    console.error('Missing or invalid variables:');
    console.error(JSON.stringify(formatted.fieldErrors, null, 2));
    console.error('═══════════════════════════════════════════════');
    process.exit(1);
  }

  _config = result.data;
  return _config;
}

export default getConfig;
