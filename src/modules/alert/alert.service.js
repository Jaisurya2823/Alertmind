/**
 * AlertMind — Alert Service
 * Handles alert submission (text/file), status tracking, and deletion.
 * Enqueues investigations via BullMQ after alert creation.
 */

import { readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { getPrismaClient } from '../../bootstrap/startup.js';
import { getRedisClient } from '../../config/redis.config.js';
import { enqueueInvestigation } from '../../shared/queue/queue.js';
import { sanitizeAlertInput } from '../../shared/validation/sanitize.js';
import { cacheGet, cacheSet, cacheDel } from '../../shared/cache/cache.js';
import { CacheKeys, CacheTTL } from '../../shared/cache/cacheKeys.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/app.error.js';
import logger from '../../shared/logger/logger.js';
import { ALERT_STATUS, INVESTIGATION_STATUS } from '../../shared/constants/app.constants.js';
import { detectAlertFormat } from '../parser/normalizer.js';

/** How long a connector-sourced externalId is remembered for dedup, in seconds */
const CONNECTOR_DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Submits a new alert from raw text/JSON paste.
 * Creates alert + investigation records, then enqueues AI analysis.
 *
 * @param {object} params
 * @param {string} params.rawInput
 * @param {string} [params.inputFormat]
 * @param {string} [params.source]
 * @param {string} params.workspaceId
 * @param {string} params.submittedBy - User ID
 * @param {string} params.ipAddress
 * @returns {Promise<{ alertId: string, investigationId: string, jobId: string }>}
 */
export async function submitAlert({ rawInput, inputFormat, source, workspaceId, submittedBy, ipAddress }) {
  const prisma = getPrismaClient();

  // Sanitize input
  const sanitized = sanitizeAlertInput(rawInput);

  if (sanitized.length < 10) {
    throw new BadRequestError('Alert input is too short or contains only whitespace');
  }

  // Auto-detect format if not specified
  const detectedFormat = inputFormat || detectAlertFormat(sanitized);

  // Create alert record
  const alert = await prisma.alert.create({
    data: {
      workspaceId,
      rawInput: sanitized,
      inputFormat: detectedFormat,
      source: source || null,
      status: ALERT_STATUS.PENDING,
      submittedBy: submittedBy || null,
      ipAddress: ipAddress || null,
    },
  });

  // Create investigation record (shell — pipeline fills it in)
  const investigation = await prisma.investigation.create({
    data: {
      alertId: alert.id,
      status: INVESTIGATION_STATUS.IN_PROGRESS,
      parsedAlert: {},
    },
  });

  // Enqueue AI analysis job
  const jobId = await enqueueInvestigation(investigation.id, alert.id, sanitized);

  logger.info({ alertId: alert.id, investigationId: investigation.id, jobId }, 'Alert submitted and queued');

  // Invalidate relevant caches
  await cacheDel(CacheKeys.alertList(workspaceId, 1, 25));

  return {
    alertId: alert.id,
    investigationId: investigation.id,
    jobId,
  };
}

/**
 * Submits a new alert from an uploaded file.
 * Reads file content, then delegates to submitAlert.
 *
 * @param {object} params
 * @param {Express.Multer.File} params.file
 * @param {string} [params.inputFormat]
 * @param {string} [params.source]
 * @param {string} params.workspaceId
 * @param {string} params.submittedBy
 * @param {string} params.ipAddress
 */
export async function submitAlertFromFile({ file, inputFormat, source, workspaceId, submittedBy, ipAddress }) {
  let rawInput;

  try {
    rawInput = readFileSync(file.path, 'utf8');
  } catch (err) {
    logger.error({ err, path: file.path }, 'Failed to read uploaded alert file');
    throw new BadRequestError('Could not read uploaded file. Ensure the file is valid UTF-8 text.');
  } finally {
    // Always delete temp file regardless of success/failure
    await unlink(file.path).catch((err) =>
      logger.warn({ err, path: file.path }, 'Failed to delete temp file')
    );
  }

  return submitAlert({
    rawInput,
    inputFormat: inputFormat || detectFormatFromMime(file.mimetype, file.originalname),
    source,
    workspaceId,
    submittedBy,
    ipAddress,
  });
}

/**
 * Gets a single alert with its investigation status.
 * @param {string} alertId
 * @param {string} workspaceId - For authorization check
 */
export async function getAlert(alertId, workspaceId) {
  const cached = await cacheGet(CacheKeys.alert(alertId));
  if (cached) return cached;

  const prisma = getPrismaClient();

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      investigation: {
        select: {
          id: true,
          status: true,
          threatCategory: true,
          processingTimeMs: true,
          createdAt: true,
          updatedAt: true,
          riskAssessment: {
            select: { severity: true, likelihood: true, impact: true },
          },
        },
      },
    },
  });

  if (!alert) throw new NotFoundError('Alert', alertId);
  if (alert.workspaceId !== workspaceId) throw new ForbiddenError('Access to this alert is not permitted');

  // Cache completed alerts — they won't change
  if (alert.status === ALERT_STATUS.COMPLETED) {
    await cacheSet(CacheKeys.alert(alertId), alert, CacheTTL.LONG);
  }

  return alert;
}

/**
 * Lists alerts for a workspace with pagination and filtering.
 */
export async function listAlerts({ workspaceId, status, severity, source, page, limit, sortBy, sortOrder, dateFrom, dateTo }) {
  const prisma = getPrismaClient();
  const skip = (page - 1) * limit;

  const where = {
    workspaceId,
    ...(status && { status }),
    ...(severity && { severity }),
    ...(source && { source }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
      : {}),
  };

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        investigation: {
          select: {
            id: true,
            status: true,
            threatCategory: true,
            riskAssessment: { select: { severity: true } },
          },
        },
      },
    }),
    prisma.alert.count({ where }),
  ]);

  return { alerts, total };
}

/**
 * Archives (soft-deletes) an alert.
 */
export async function archiveAlert(alertId, workspaceId) {
  const prisma = getPrismaClient();

  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new NotFoundError('Alert', alertId);
  if (alert.workspaceId !== workspaceId) throw new ForbiddenError();

  await prisma.alert.update({
    where: { id: alertId },
    data: { status: ALERT_STATUS.ARCHIVED },
  });

  await cacheDel(CacheKeys.alert(alertId));
}

/**
 * Ingests a single event pulled from a live connector (Splunk, Elastic, ...)
 * into the normal alert → investigation → AI pipeline.
 *
 * Deduplication: uses a Redis SET-NX on `connectorId:externalId` so the same
 * event polled twice (overlapping sync windows) doesn't create duplicate
 * investigations or burn AI budget twice.
 *
 * @param {object} params
 * @param {string} params.workspaceId
 * @param {string} params.connectorType - e.g. 'SPLUNK', 'ELASTIC'
 * @param {string} params.rawInput
 * @param {string} params.externalId - Source system's unique ID for this event
 * @returns {Promise<{ alertId: string, investigationId: string, jobId: string } | null>}
 *   Returns null if the event was already ingested (duplicate).
 */
export async function ingestConnectorAlert({ workspaceId, connectorType, rawInput, externalId }) {
  const prisma = getPrismaClient();

  // Dedup guard — SET with NX (only-if-not-exists) is atomic, safe under concurrent syncs
  const dedupKey = `connector:seen:${workspaceId}:${externalId}`;
  const redis = getRedisClient();
  const wasSet = await redis.set(dedupKey, '1', 'EX', CONNECTOR_DEDUP_TTL_SECONDS, 'NX');

  if (wasSet !== 'OK') {
    // Already ingested — not an error, just a no-op
    return null;
  }

  const sanitized = sanitizeAlertInput(rawInput);
  if (sanitized.length < 10) {
    logger.warn({ workspaceId, connectorType, externalId }, 'Connector event too short — skipped');
    return null;
  }

  const detectedFormat = detectAlertFormat(sanitized);

  const alert = await prisma.alert.create({
    data: {
      workspaceId,
      rawInput: sanitized,
      inputFormat: detectedFormat,
      source: mapConnectorTypeToSource(connectorType),
      status: ALERT_STATUS.PENDING,
      submittedBy: null, // No human submitted this — came from a live connector
    },
  });

  const investigation = await prisma.investigation.create({
    data: {
      alertId: alert.id,
      status: INVESTIGATION_STATUS.IN_PROGRESS,
      parsedAlert: {},
    },
  });

  const jobId = await enqueueInvestigation(investigation.id, alert.id, sanitized);

  await cacheDel(CacheKeys.alertList(workspaceId, 1, 25));

  logger.info(
    { alertId: alert.id, investigationId: investigation.id, connectorType, externalId },
    'Connector event ingested and queued for investigation'
  );

  return { alertId: alert.id, investigationId: investigation.id, jobId };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function mapConnectorTypeToSource(connectorType) {
  const map = {
    SPLUNK: 'SPLUNK',
    ELASTIC: 'ELASTIC',
  };
  return map[connectorType] || null;
}

function detectFormatFromMime(mimetype, filename) {
  if (filename?.endsWith('.json') || mimetype === 'application/json') return 'JSON';
  if (filename?.endsWith('.xml') || mimetype === 'application/xml') return 'WINDOWS_EVENT';
  if (filename?.endsWith('.csv') || mimetype === 'text/csv') return 'CSV';
  return 'PLAIN_TEXT';
}
