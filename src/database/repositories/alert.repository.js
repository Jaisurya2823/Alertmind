/**
 * AlertMind — Alert Repository
 * Prisma repository pattern — all Alert DB operations go through this class.
 * Keeps service layer clean; centralizes query logic for reuse and caching.
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class AlertRepository {
  get prisma() {
    return getPrismaClient();
  }

  async findById(id) {
    return this.prisma.alert.findUnique({
      where: { id },
      include: {
        investigation: {
          select: {
            id: true, status: true, threatCategory: true, processingTimeMs: true,
            riskAssessment: { select: { severity: true } },
          },
        },
      },
    });
  }

  async findByWorkspace(workspaceId, { skip = 0, take = 25, where = {}, orderBy = { createdAt: 'desc' } } = {}) {
    const [items, total] = await Promise.all([
      this.prisma.alert.findMany({
        where: { workspaceId, ...where },
        skip,
        take,
        orderBy,
        include: {
          investigation: {
            select: { id: true, status: true, threatCategory: true, riskAssessment: { select: { severity: true } } },
          },
        },
      }),
      this.prisma.alert.count({ where: { workspaceId, ...where } }),
    ]);
    return { items, total };
  }

  async create(data) {
    return this.prisma.alert.create({ data });
  }

  async updateStatus(id, status) {
    return this.prisma.alert.update({ where: { id }, data: { status } });
  }

  async archive(id) {
    return this.prisma.alert.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async countByWorkspace(workspaceId) {
    return this.prisma.alert.count({ where: { workspaceId } });
  }
}

export const alertRepository = new AlertRepository();
