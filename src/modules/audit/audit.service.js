/**
 * AlertMind — Audit Service
 * All security-significant actions are logged here.
 * Audit logs are append-only — no updates or deletes.
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import logger from '../../shared/logger/logger.js';

/**
 * Creates an audit log entry.
 * Failures are logged but never thrown — audit must not break primary operations.
 *
 * @param {object} params
 * @param {string|null} [params.userId]
 * @param {string} params.action - From AUDIT_ACTION constants
 * @param {string} params.resource - Resource type (e.g., 'alert', 'investigation')
 * @param {string|null} [params.resourceId]
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 * @param {Record<string, unknown>|null} [params.metadata]
 */
export async function createAuditLog({ userId, action, resource, resourceId, ipAddress, userAgent, metadata }) {
  try {
    const prisma = getPrismaClient();
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        resource,
        resourceId: resourceId || null,
        ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
        metadata: metadata || null,
      },
    });
  } catch (err) {
    // Never throw — audit failure must not break the calling operation
    logger.error({ err, action, resource, resourceId }, 'Failed to create audit log');
  }
}

/**
 * Lists audit logs for a resource or user.
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.resource]
 * @param {string} [params.resourceId]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export async function listAuditLogs({ userId, resource, resourceId, page = 1, limit = 50 }) {
  const prisma = getPrismaClient();
  const skip = (page - 1) * limit;

  const where = {
    ...(userId && { userId }),
    ...(resource && { resource }),
    ...(resourceId && { resourceId }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
