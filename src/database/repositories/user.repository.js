/**
 * AlertMind — User Repository
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class UserRepository {
  get prisma() {
    return getPrismaClient();
  }

  async findById(id) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, organizationId: true, lastLoginAt: true, createdAt: true,
      },
    });
  }

  async findByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true, email: true, name: true, role: true,
        passwordHash: true, isActive: true, organizationId: true,
        mfaEnabled: true,
      },
    });
  }

  async create(data) {
    return this.prisma.user.create({ data });
  }

  async updateLastLogin(id) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async updatePassword(id, passwordHash) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async deactivate(id) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async countByOrganization(organizationId) {
    return this.prisma.user.count({ where: { organizationId } });
  }
}

export const userRepository = new UserRepository();
