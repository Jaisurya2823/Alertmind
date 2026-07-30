/**
 * AlertMind — Notification Repository
 */

import { getPrismaClient } from '../../bootstrap/startup.js';

export class NotificationRepository {
  get prisma() {
    return getPrismaClient();
  }

  async create(data) {
    return this.prisma.notification.create({ data });
  }

  async findByUser(userId, { skip = 0, take = 25, unreadOnly = false } = {}) {
    const where = { userId, ...(unreadOnly && { isRead: false }) };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, total, unreadCount };
  }

  async markRead(id, userId) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteOld(olderThanDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    return this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff }, isRead: true },
    });
  }
}

export const notificationRepository = new NotificationRepository();
