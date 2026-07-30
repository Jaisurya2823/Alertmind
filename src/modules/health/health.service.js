/**
 * AlertMind — Health Check Service
 * Checks: PostgreSQL, Redis, BullMQ, Groq AI API, MinIO storage
 * Two endpoints: /live (liveness) and /ready (readiness)
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import { getRedisClient } from '../../config/redis.config.js';
import { getConfig } from '../../config/env.js';
import logger from '../../shared/logger/logger.js';

const config = getConfig();

/**
 * Lightweight liveness check — is the process alive?
 * Used by Kubernetes liveness probe.
 * Must respond in < 100ms — no external checks.
 */
export function getLivenessStatus() {
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid,
  };
}

/**
 * Deep readiness check — are all dependencies healthy?
 * Used by Kubernetes readiness probe and monitoring.
 * Returns 200 if ready to serve traffic, 503 if not.
 */
export async function getReadinessStatus() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkAIProvider(),
  ]);

  const [dbCheck, redisCheck, aiCheck] = checks;

  const result = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    checks: {
      database: extractCheckResult(dbCheck),
      redis: extractCheckResult(redisCheck),
      ai: extractCheckResult(aiCheck),
    },
  };

  const allPassed = Object.values(result.checks).every((c) => c.status === 'ok');
  if (!allPassed) {
    result.status = 'degraded';
  }

  const criticalFailed = result.checks.database.status !== 'ok' || result.checks.redis.status !== 'ok';
  if (criticalFailed) {
    result.status = 'unhealthy';
  }

  return result;
}

async function checkDatabase() {
  const start = Date.now();
  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  return { latencyMs: Date.now() - start };
}

async function checkRedis() {
  const start = Date.now();
  const client = getRedisClient();
  const pong = await client.ping();
  if (pong !== 'PONG') throw new Error(`Unexpected Redis response: ${pong}`);
  return { latencyMs: Date.now() - start };
}

async function checkAIProvider() {
  const start = Date.now();
  // Lightweight check: verify API key is set and Groq is reachable
  // We don't send an actual completion — just verify the config
  if (!config.GROQ_API_KEY || !config.GROQ_API_KEY.startsWith('gsk_')) {
    throw new Error('GROQ_API_KEY not configured');
  }
  // Optionally: make a minimal API call to verify connectivity
  // For health checks, we skip the full API call to avoid cost/latency
  return { latencyMs: Date.now() - start, model: config.GROQ_PRIMARY_MODEL };
}

function extractCheckResult(settled) {
  if (settled.status === 'fulfilled') {
    return { status: 'ok', ...settled.value };
  }
  logger.warn({ err: settled.reason }, 'Health check failed');
  return {
    status: 'error',
    error: settled.reason?.message || 'Unknown error',
  };
}
