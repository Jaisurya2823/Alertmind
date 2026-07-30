/**
 * AlertMind — Connector Service
 * Manages live connector lifecycle: create, test, sync, enable/disable, delete.
 * Config is always encrypted before touching the database and decrypted
 * only in-memory for the duration of a provider call.
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import { encryptJson, decryptJson } from '../../shared/crypto/crypto.js';
import { getProvider } from './providers/provider.registry.js';
import {
  scheduleConnectorSync,
  unscheduleConnectorSync,
  enqueueConnectorSyncNow,
} from '../../shared/queue/queue.js';
import { ingestConnectorAlert } from '../alert/alert.service.js';
import { cacheDel } from '../../shared/cache/cache.js';
import { CacheKeys } from '../../shared/cache/cacheKeys.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/app.error.js';
import { SYNC_STATUS, INITIAL_SYNC_LOOKBACK_MINUTES, MAX_ALERTS_PER_SYNC } from './connector.constants.js';
import logger from '../../shared/logger/logger.js';

/**
 * Creates a new connector. Config is encrypted before storage.
 * A test connection is required to pass before the connector is saved.
 */
export async function createConnector({ type, workspaceId, name, config, syncIntervalMinutes }) {
  const prisma = getPrismaClient();

  const provider = getProvider(type);
  const testResult = await provider.testConnection(config);

  if (!testResult.success) {
    throw new BadRequestError(`Connection test failed: ${testResult.message}`);
  }

  const configEncrypted = encryptJson(config);

  const connector = await prisma.connector.create({
    data: {
      workspaceId,
      type,
      name,
      configEncrypted,
      enabled: true,
      syncStatus: SYNC_STATUS.IDLE,
    },
  });

  await scheduleConnectorSync(connector.id, syncIntervalMinutes);

  logger.info({ connectorId: connector.id, type, workspaceId }, 'Connector created and scheduled');

  return toSafeConnector(connector);
}

/**
 * Lists connectors for a workspace. Config is never included.
 */
export async function listConnectors(workspaceId) {
  const prisma = getPrismaClient();
  const connectors = await prisma.connector.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  return connectors.map(toSafeConnector);
}

/**
 * Gets a single connector (config never included).
 */
export async function getConnector(connectorId, workspaceId) {
  const prisma = getPrismaClient();
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });

  if (!connector) throw new NotFoundError('Connector', connectorId);
  if (connector.workspaceId !== workspaceId) throw new ForbiddenError();

  return toSafeConnector(connector);
}

/**
 * Updates a connector. If config changes, re-tests the connection first.
 */
export async function updateConnector(connectorId, workspaceId, updates) {
  const prisma = getPrismaClient();
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });

  if (!connector) throw new NotFoundError('Connector', connectorId);
  if (connector.workspaceId !== workspaceId) throw new ForbiddenError();

  const data = {};

  if (updates.name !== undefined) data.name = updates.name;

  if (updates.config !== undefined) {
    const provider = getProvider(connector.type);
    const testResult = await provider.testConnection(updates.config);
    if (!testResult.success) {
      throw new BadRequestError(`Connection test failed: ${testResult.message}`);
    }
    data.configEncrypted = encryptJson(updates.config);
  }

  if (updates.enabled !== undefined) {
    data.enabled = updates.enabled;
  }

  const updated = await prisma.connector.update({ where: { id: connectorId }, data });

  if (updates.enabled === false) {
    await unscheduleConnectorSync(connectorId);
  } else if (updates.syncIntervalMinutes || updates.enabled === true) {
    await scheduleConnectorSync(connectorId, updates.syncIntervalMinutes || 15);
  }

  await cacheDel(CacheKeys.connectorList(workspaceId));

  return toSafeConnector(updated);
}

/**
 * Deletes a connector and removes its scheduled sync.
 */
export async function deleteConnector(connectorId, workspaceId) {
  const prisma = getPrismaClient();
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });

  if (!connector) throw new NotFoundError('Connector', connectorId);
  if (connector.workspaceId !== workspaceId) throw new ForbiddenError();

  await unscheduleConnectorSync(connectorId);
  await prisma.connector.delete({ where: { id: connectorId } });
  await cacheDel(CacheKeys.connectorList(workspaceId));

  logger.info({ connectorId }, 'Connector deleted');
}

/**
 * Tests a connection without saving anything.
 */
export async function testConnectorConnection(type, config) {
  const provider = getProvider(type);
  return provider.testConnection(config);
}

/**
 * Triggers an immediate manual sync (bypasses the schedule, runs now).
 */
export async function triggerManualSync(connectorId, workspaceId) {
  const prisma = getPrismaClient();
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });

  if (!connector) throw new NotFoundError('Connector', connectorId);
  if (connector.workspaceId !== workspaceId) throw new ForbiddenError();
  if (!connector.enabled) throw new BadRequestError('Cannot sync a disabled connector');

  const jobId = await enqueueConnectorSyncNow(connectorId);
  return { jobId };
}

/**
 * Executes the actual sync — called by the BullMQ worker (jobs.js).
 * Fetches new events since lastSyncAt, ingests each as an alert + investigation.
 */
export async function runConnectorSync(connectorId) {
  const prisma = getPrismaClient();
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });

  if (!connector) {
    logger.warn({ connectorId }, 'Sync skipped — connector no longer exists');
    return { ingested: 0 };
  }

  if (!connector.enabled) {
    logger.info({ connectorId }, 'Sync skipped — connector disabled');
    return { ingested: 0 };
  }

  await prisma.connector.update({
    where: { id: connectorId },
    data: { syncStatus: SYNC_STATUS.SYNCING },
  });

  const since = connector.lastSyncAt || minutesAgo(INITIAL_SYNC_LOOKBACK_MINUTES);

  try {
    const config = decryptJson(connector.configEncrypted);
    const provider = getProvider(connector.type);

    const events = await provider.fetchAlerts(config, since);
    const capped = events.slice(0, MAX_ALERTS_PER_SYNC);

    let ingested = 0;
    for (const event of capped) {
      try {
        await ingestConnectorAlert({
          workspaceId: connector.workspaceId,
          connectorType: connector.type,
          rawInput: event.rawInput,
          externalId: event.externalId,
        });
        ingested++;
      } catch (err) {
        logger.warn({ err: err.message, connectorId, externalId: event.externalId }, 'Failed to ingest one connector event');
      }
    }

    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        syncStatus: SYNC_STATUS.SUCCESS,
        lastSyncAt: new Date(),
      },
    });

    logger.info({ connectorId, fetched: capped.length, ingested }, 'Connector sync completed');
    return { ingested };
  } catch (err) {
    await prisma.connector.update({
      where: { id: connectorId },
      data: { syncStatus: SYNC_STATUS.ERROR },
    });
    logger.error({ err, connectorId }, 'Connector sync failed');
    throw err;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSafeConnector(connector) {
  const { configEncrypted, ...safe } = connector;
  return safe;
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}
