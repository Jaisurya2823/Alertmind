/**
 * AlertMind — Investigation Repository
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class InvestigationRepository {
  get prisma() {
    return getPrismaClient();
  }

  async findById(id) {
    return this.prisma.investigation.findUnique({ where: { id } });
  }

  async findByAlertId(alertId) {
    return this.prisma.investigation.findUnique({ where: { alertId } });
  }

  async create(data) {
    return this.prisma.investigation.create({ data });
  }

  async updateStatus(id, status, extra = {}) {
    return this.prisma.investigation.update({ where: { id }, data: { status, ...extra } });
  }

  async updateParsedAlert(id, parsedAlert) {
    return this.prisma.investigation.update({ where: { id }, data: { parsedAlert } });
  }

  async markCompleted(id, processingTimeMs, modelUsed) {
    return this.prisma.investigation.update({
      where: { id },
      data: { status: 'COMPLETED', processingTimeMs, modelUsed },
    });
  }

  async markFailed(id, errorMessage, processingTimeMs) {
    return this.prisma.investigation.update({
      where: { id },
      data: { status: 'FAILED', errorMessage, processingTimeMs },
    });
  }

  async countByStatus(workspaceId) {
    return this.prisma.investigation.groupBy({
      by: ['status'],
      where: { alert: { workspaceId } },
      _count: { status: true },
    });
  }
}

export const investigationRepository = new InvestigationRepository();
