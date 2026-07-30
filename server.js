/**
 * AlertMind — Server Entry Point
 * Production Node.js 22 LTS — ES Modules
 */

import { createServer } from 'node:http';
import { initializeTelemetry } from './src/shared/telemetry/telemetry.js';
import { initializeTracing, shutdownTracing } from './src/shared/telemetry/tracing.js';

// Initialize OpenTelemetry FIRST — before any other imports
// This must run before Express/Prisma/Redis to correctly instrument them
initializeTelemetry();
initializeTracing();

// ─── Deferred imports (after telemetry init) ────────────────────────────────
const { default: app } = await import('./app.js');
const { getConfig } = await import('./src/config/env.js');
const { connectDatabase, disconnectDatabase } = await import('./src/bootstrap/startup.js');
const { connectRedis, disconnectRedis } = await import('./src/config/redis.config.js');
const { startMetricsServer, stopMetricsServer } = await import('./src/shared/metrics/metrics.js');
const { default: logger } = await import('./src/shared/logger/logger.js');
const { startQueueWorkers, stopQueueWorkers } = await import('./src/shared/queue/queue.js');
const { ensureStorageReady } = await import('./src/config/storage.config.js');

const config = getConfig();

const server = createServer(app);

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress, forcing exit');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Initiating graceful shutdown');

  // Timeout: force exit after 30s
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30s, forcing exit');
    process.exit(1);
  }, 30_000);
  forceExitTimer.unref();

  try {
    // 1. Stop accepting new connections
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info('HTTP server closed');

    // 2. Stop queue workers (finish current jobs)
    await stopQueueWorkers();
    logger.info('Queue workers stopped');

    // 3. Disconnect database
    await disconnectDatabase();
    logger.info('Database disconnected');

    // 4. Disconnect Redis
    await disconnectRedis();
    logger.info('Redis disconnected');

    // 4b. Flush and shut down tracing (no-op if tracing was never initialized)
    await shutdownTracing();
    logger.info('Tracing shut down');

    // 5. Stop metrics server
    await stopMetricsServer();
    logger.info('Metrics server stopped');

    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.fatal({ error }, 'Error during graceful shutdown');
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Connect to PostgreSQL via Prisma
    await connectDatabase();
    logger.info('PostgreSQL connected');

    // Connect to Redis (ioredis)
    await connectRedis();
    logger.info('Redis connected');

    // Initialize storage provider (creates local storage directory,
    // or verifies MinIO bucket exists — depends on STORAGE_PROVIDER)
    await ensureStorageReady();

    // Start BullMQ workers
    await startQueueWorkers();
    logger.info('Queue workers started');

    // Start Prometheus metrics server on separate port
    if (config.METRICS_ENABLED) {
      await startMetricsServer(config.METRICS_PORT);
      logger.info({ port: config.METRICS_PORT }, 'Metrics server started');
    }

    // Start HTTP server
    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(config.PORT, () => {
        server.off('error', reject);
        resolve();
      });
    });

    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        pid: process.pid,
        node: process.version,
      },
      'AlertMind server started'
    );
  } catch (error) {
    logger.fatal({ error }, 'Fatal: Failed to bootstrap server');
    process.exit(1);
  }
}

// ─── Process Signal Handlers ─────────────────────────────────────────────────
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Process Error Handlers ───────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    { reason: String(reason), promise: String(promise) },
    'Unhandled Promise Rejection — scheduling shutdown'
  );
  // Give the logger time to flush before exiting
  setTimeout(() => gracefulShutdown('unhandledRejection'), 100);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception — scheduling shutdown');
  setTimeout(() => gracefulShutdown('uncaughtException'), 100);
});

// ─── Start ───────────────────────────────────────────────────────────────────
bootstrap();

export default server;
