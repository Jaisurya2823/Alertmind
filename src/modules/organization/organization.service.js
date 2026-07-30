/**
 * AlertMind — Organization Service
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import { cacheGet, cacheSet, cacheDel } from '../../shared/cache/cache.js';
import { CacheKeys, CacheTTL } from '../../shared/cache/cacheKeys.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/app.error.js';

export async function getOrganization(orgId, requestingUserId) {
  const cached = await cacheGet(CacheKeys.organization(orgId));
  if (cached) return cached;

  const prisma = getPrismaClient();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      settings: true,
      billing: { select: { plan: true, investigationsUsed: true, investigationsLimit: true } },
      _count: { select: { users: true, workspaces: true } },
    },
  });

  if (!org) throw new NotFoundError('Organization', orgId);

  // Verify requester belongs to this org
  const user = await prisma.user.findUnique({
    where: { id: requestingUserId },
    select: { organizationId: true },
  });
  if (!user || user.organizationId !== orgId) throw new ForbiddenError();

  await cacheSet(CacheKeys.organization(orgId), org, CacheTTL.MEDIUM);
  return org;
}

export async function updateOrganizationSettings(orgId, settings, requestingUserId) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: requestingUserId },
    select: { organizationId: true, role: true },
  });

  if (!user || user.organizationId !== orgId) throw new ForbiddenError();
  if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenError('Admin role required');

  const updated = await prisma.organizationSettings.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, ...settings },
    update: settings,
  });

  await cacheDel(CacheKeys.organization(orgId));
  await cacheDel(CacheKeys.organizationSettings(orgId));

  return updated;
}

export async function getOrganizationMembers(orgId, page = 1, limit = 25) {
  const prisma = getPrismaClient();
  const skip = (page - 1) * limit;

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
    }),
    prisma.user.count({ where: { organizationId: orgId } }),
  ]);

  return { members, total };
}
