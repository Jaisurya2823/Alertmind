/**
 * AlertMind — API Key Service
 * Creates, lists, and revokes organization API keys.
 * Keys are stored as SHA-256 hashes — the raw key is shown only once.
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import { randomBytes } from 'node:crypto';
import { sha256 } from '../../shared/crypto/crypto.js';
import { cacheDel } from '../../shared/cache/cache.js';
import { CacheKeys } from '../../shared/cache/cacheKeys.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/app.error.js';
import { API_KEY_PREFIX, API_KEY_BYTES, API_KEY_PREFIX_LENGTH } from '../../shared/constants/security.constants.js';

/**
 * Creates a new API key for an organization.
 * Returns the raw key exactly once — it cannot be retrieved again.
 */
export async function createApiKey({ organizationId, name, permissions, expiresAt, userId }) {
  const prisma = getPrismaClient();

  // Verify user belongs to organization
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, role: true } });
  if (!user || user.organizationId !== organizationId) throw new ForbiddenError();
  if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenError('Admin role required to create API keys');

  // Generate cryptographically secure key
  const rawKey = `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('hex')}`;
  const keyHash = sha256(rawKey);
  const keyPrefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);

  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId,
      name,
      keyHash,
      keyPrefix,
      permissions: permissions || [],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true, name: true, keyPrefix: true, permissions: true, expiresAt: true, createdAt: true },
  });

  // Return raw key exactly once — it's never stored
  return { ...apiKey, rawKey };
}

/**
 * Lists API keys for an organization (hashes never returned).
 */
export async function listApiKeys(organizationId, userId) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user || user.organizationId !== organizationId) throw new ForbiddenError();

  return prisma.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, keyPrefix: true, permissions: true,
      isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true,
    },
  });
}

/**
 * Revokes (deactivates) an API key.
 */
export async function revokeApiKey(keyId, organizationId, userId) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, role: true } });
  if (!user || user.organizationId !== organizationId) throw new ForbiddenError();
  if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenError();

  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key) throw new NotFoundError('API key', keyId);
  if (key.organizationId !== organizationId) throw new ForbiddenError();
  if (!key.isActive) throw new BadRequestError('API key is already revoked');

  await prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false } });

  // Invalidate cache so the revoked key is rejected immediately
  await cacheDel(CacheKeys.apiKey(key.keyHash));
}
