/**
 * AlertMind — Server Startup & Database Bootstrap
 * Prisma connection management and startup health checks
 */

import { PrismaClient } from '@prisma/client';
import logger from '../shared/logger/logger.js';

// ─── Prisma Singleton ────────────────────────────────────────────────────────
// Single PrismaClient instance per process — prevents connection pool exhaustion

/** @type {PrismaClient | null} */
let _prisma = null;

/**
 * Returns the singleton PrismaClient instance.
 * @returns {PrismaClient}
 */
export function getPrismaClient() {
  if (!_prisma) {
    throw new Error('Prisma client not initialized. Call connectDatabase() first.');
  }
  return _prisma;
}

/**
 * Initializes PrismaClient and verifies database connectivity.
 * Runs a raw SELECT 1 to confirm the DB is reachable.
 */
export async function connectDatabase() {
  _prisma = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
      // Query logging only in development (avoid exposing SQL in production logs)
      ...(process.env.NODE_ENV === 'development'
        ? [{ level: 'query', emit: 'event' }]
        : []),
    ],
    errorFormat: 'minimal',
  });

  // Route Prisma log events to Pino
  _prisma.$on('error', (e) => logger.error({ message: e.message, target: e.target }, 'Prisma error'));
  _prisma.$on('warn', (e) => logger.warn({ message: e.message, target: e.target }, 'Prisma warning'));

  if (process.env.NODE_ENV === 'development') {
    _prisma.$on('query', (e) =>
      logger.debug({ query: e.query, duration: e.duration }, 'Prisma query')
    );
  }

  // Connect and verify
  await _prisma.$connect();

  // Verify DB is reachable with a lightweight query
  await _prisma.$queryRaw`SELECT 1`;
}

/**
 * Disconnects PrismaClient.
 * Called during graceful shutdown.
 */
export async function disconnectDatabase() {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
