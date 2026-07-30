/**
 * AlertMind — Settings Repository
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class SettingsRepository {
  get prisma() {
    return getPrismaClient();
  }

  async findByOrganization(organizationId) {
    return this.prisma.organizationSettings.findUnique({ where: { organizationId } });
  }

  async upsert(organizationId, data) {
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }
}

export const settingsRepository = new SettingsRepository();
