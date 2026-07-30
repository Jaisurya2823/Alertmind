/**
 * AlertMind — Organization Repository
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class OrganizationRepository {
  get prisma() {
    return getPrismaClient();
  }

  async findById(id) {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async findBySlug(slug) {
    return this.prisma.organization.findUnique({ where: { slug } });
  }

  async create(data) {
    return this.prisma.organization.create({ data });
  }

  async updatePlan(id, plan) {
    return this.prisma.organization.update({ where: { id }, data: { plan } });
  }

  async deactivate(id) {
    return this.prisma.organization.update({ where: { id }, data: { isActive: false } });
  }
}

export const organizationRepository = new OrganizationRepository();
