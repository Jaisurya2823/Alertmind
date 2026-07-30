/**
 * AlertMind — Investigation Service
 * Retrieves investigation results with all nested agent outputs.
 * Handles status polling, full result retrieval, and retry triggering.
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import { enqueueInvestigation } from '../../shared/queue/queue.js';
import { cacheGet, cacheSet, cacheDel } from '../../shared/cache/cache.js';
import { CacheKeys, CacheTTL } from '../../shared/cache/cacheKeys.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/app.error.js';
import { INVESTIGATION_STATUS, ALERT_STATUS } from '../../shared/constants/app.constants.js';
import logger from '../../shared/logger/logger.js';

// Full investigation select — all nested data for complete response
const FULL_INVESTIGATION_SELECT = {
  id: true,
  alertId: true,
  status: true,
  parsedAlert: true,
  explanation: true,
  threatCategory: true,
  modelUsed: true,
  processingTimeMs: true,
  tokenCount: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  entities: {
    orderBy: { type: 'asc' },
    select: { id: true, type: true, value: true, context: true, confidence: true, createdAt: true },
  },
  iocs: {
    orderBy: { type: 'asc' },
    select: { id: true, type: true, value: true, malicious: true, confidence: true, tlp: true, enrichmentData: true },
  },
  mitreMappings: {
    orderBy: { confidence: 'desc' },
    select: {
      id: true, techniqueId: true, techniqueName: true,
      tacticId: true, tacticName: true,
      subTechniqueId: true, subTechniqueName: true,
      confidence: true, reasoning: true, killChainPhase: true,
    },
  },
  hypotheses: {
    orderBy: { ordering: 'asc' },
    select: { id: true, text: true, confidence: true, evidence: true, ordering: true },
  },
  timelineEvents: {
    orderBy: { ordering: 'asc' },
    select: { id: true, eventTimestamp: true, event: true, source: true, ordering: true },
  },
  riskAssessment: {
    select: {
      id: true, severity: true, likelihood: true, impact: true,
      confidence: true, businessImpact: true, justification: true,
      cvssScore: true, createdAt: true,
    },
  },
  recommendations: {
    orderBy: { ordering: 'asc' },
    select: { id: true, text: true, priority: true, category: true, commands: true, ordering: true },
  },
  report: {
    select: {
      id: true, executiveSummary: true, technicalSummary: true,
      markdownContent: true, pdfStoragePath: true, exportedAt: true, createdAt: true,
    },
  },
  alert: {
    select: { id: true, inputFormat: true, source: true, severity: true, status: true, createdAt: true },
  },
};

/**
 * Gets a single investigation by ID with full nested data.
 * Only returns completed investigations from cache — in-progress are always live.
 *
 * @param {string} investigationId
 * @param {string} workspaceId - For authorization
 */
export async function getInvestigation(investigationId, workspaceId) {
  // In-progress investigations: skip cache, always return live status
  const prisma = getPrismaClient();

  // Quick status check before full fetch (avoids cache poisoning in-progress results)
  const statusCheck = await prisma.investigation.findUnique({
    where: { id: investigationId },
    select: { status: true, alertId: true },
  });

  if (!statusCheck) throw new NotFoundError('Investigation', investigationId);

  // Authorization: verify alert belongs to workspace
  const alert = await prisma.alert.findUnique({
    where: { id: statusCheck.alertId },
    select: { workspaceId: true },
  });

  if (!alert || alert.workspaceId !== workspaceId) {
    throw new ForbiddenError('Access to this investigation is not permitted');
  }

  // Completed investigations: serve from cache
  if (statusCheck.status === INVESTIGATION_STATUS.COMPLETED) {
    const cached = await cacheGet(CacheKeys.investigation(investigationId));
    if (cached) return cached;
  }

  const investigation = await prisma.investigation.findUnique({
    where: { id: investigationId },
    select: FULL_INVESTIGATION_SELECT,
  });

  if (!investigation) throw new NotFoundError('Investigation', investigationId);

  // Cache only completed investigations
  if (investigation.status === INVESTIGATION_STATUS.COMPLETED) {
    await cacheSet(CacheKeys.investigation(investigationId), investigation, CacheTTL.LONG);
  }

  return investigation;
}

/**
 * Gets just the status of an investigation — lightweight polling endpoint.
 * @param {string} investigationId
 */
export async function getInvestigationStatus(investigationId) {
  const prisma = getPrismaClient();

  const investigation = await prisma.investigation.findUnique({
    where: { id: investigationId },
    select: {
      id: true,
      status: true,
      threatCategory: true,
      processingTimeMs: true,
      errorMessage: true,
      updatedAt: true,
      riskAssessment: { select: { severity: true } },
    },
  });

  if (!investigation) throw new NotFoundError('Investigation', investigationId);
  return investigation;
}

/**
 * Lists investigations for a workspace with pagination and filtering.
 */
export async function listInvestigations({ workspaceId, status, threatCategory, severity, page, limit, sortBy, sortOrder, dateFrom, dateTo }) {
  const prisma = getPrismaClient();
  const skip = (page - 1) * limit;

  // Join via alert to filter by workspaceId
  const where = {
    alert: { workspaceId },
    ...(status && { status }),
    ...(threatCategory && { threatCategory }),
    ...(severity && { riskAssessment: { severity } }),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } }
      : {}),
  };

  const [investigations, total] = await Promise.all([
    prisma.investigation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        status: true,
        threatCategory: true,
        processingTimeMs: true,
        createdAt: true,
        updatedAt: true,
        alert: { select: { id: true, inputFormat: true, source: true, severity: true, createdAt: true } },
        riskAssessment: { select: { severity: true, likelihood: true } },
        _count: { select: { entities: true, iocs: true, mitreMappings: true } },
      },
    }),
    prisma.investigation.count({ where }),
  ]);

  return { investigations, total };
}

/**
 * Retries a failed investigation by re-enqueuing it.
 * @param {string} investigationId
 * @param {string} workspaceId
 */
export async function retryInvestigation(investigationId, workspaceId) {
  const prisma = getPrismaClient();

  const investigation = await prisma.investigation.findUnique({
    where: { id: investigationId },
    include: { alert: { select: { workspaceId: true, rawInput: true, id: true } } },
  });

  if (!investigation) throw new NotFoundError('Investigation', investigationId);
  if (investigation.alert.workspaceId !== workspaceId) throw new ForbiddenError();

  if (investigation.status !== INVESTIGATION_STATUS.FAILED) {
    throw new BadRequestError('Only FAILED investigations can be retried');
  }

  // Reset investigation state
  await prisma.investigation.update({
    where: { id: investigationId },
    data: {
      status: INVESTIGATION_STATUS.IN_PROGRESS,
      errorMessage: null,
      processingTimeMs: null,
    },
  });

  await prisma.alert.update({
    where: { id: investigation.alertId },
    data: { status: ALERT_STATUS.PROCESSING },
  });

  // Clear cache for this investigation
  await cacheDel(CacheKeys.investigation(investigationId));

  const jobId = await enqueueInvestigation(
    investigationId,
    investigation.alertId,
    investigation.alert.rawInput
  );

  logger.info({ investigationId, jobId }, 'Investigation retry enqueued');

  return { investigationId, jobId, status: INVESTIGATION_STATUS.IN_PROGRESS };
}
