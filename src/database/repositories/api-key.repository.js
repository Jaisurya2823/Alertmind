/**
 * AlertMind — API Key Repository
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class ApiKeyRepository {
  get prisma() {
    return getPrismaClient();
  }

  async findByHash(keyHash) {
    return this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { organization: { select: { id: true, isActive: true } } },
    });
  }

  async findById(id) {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  async findByOrganization(organizationId) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, keyPrefix: true, permissions: true,
        isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true,
      },
    });
  }

  async create(data) {
    return this.prisma.apiKey.create({ data });
  }

  async revoke(id) {
    return this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
  }

  async touchLastUsed(keyHash) {
    return this.prisma.apiKey.update({
      where: { keyHash },
      data: { lastUsedAt: new Date() },
    });
  }
}

export const apiKeyRepository = new ApiKeyRepository();
