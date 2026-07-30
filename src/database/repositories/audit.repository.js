/**
 * AlertMind — Audit Log Repository
 * Append-only — no update or delete operations.
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class AuditRepository {
  get prisma() {
    return getPrismaClient();
  }

  async create(data) {
    return this.prisma.auditLog.create({ data });
  }

  async findMany({ userId, resource, resourceId, skip = 0, take = 50 } = {}) {
    const where = {
      ...(userId && { userId }),
      ...(resource && { resource }),
      ...(resourceId && { resourceId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}

export const auditRepository = new AuditRepository();
