/**
 * AlertMind — User Service
 * Registration, authentication, JWT issuance, and profile management.
 * Uses Argon2id for password hashing, RS256 JWT for tokens.
 */

import argon2 from 'argon2';
import { SignJWT, importPKCS8 } from 'jose';
import { getPrismaClient } from '../../bootstrap/startup.js';
import { getRedisClient } from '../../config/redis.config.js';
import { getConfig } from '../../config/env.js';
import { cacheGet, cacheSet, cacheDel } from '../../shared/cache/cache.js';
import { CacheKeys, CacheTTL } from '../../shared/cache/cacheKeys.js';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '../../shared/errors/app.error.js';
import {
  ARGON2_OPTIONS,
  JWT_ALGORITHM,
  JWT_ACCESS_TOKEN_EXPIRY,
  JWT_REFRESH_TOKEN_EXPIRY,
  JWT_ISSUER,
  JWT_AUDIENCE,
} from '../../shared/constants/security.constants.js';
import { normalizeEmail } from '../../shared/validation/sanitize.js';
import { randomBase64url } from '../../shared/crypto/crypto.js';
import logger from '../../shared/logger/logger.js';

const config = getConfig();

// Cache the parsed private key — expensive to import on every login
let _privateKey = null;
async function getPrivateKey() {
  if (_privateKey) return _privateKey;
  const pem = config.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  _privateKey = await importPKCS8(pem, JWT_ALGORITHM);
  return _privateKey;
}

/**
 * Registers a new user and creates their organization.
 * @param {{ name: string, email: string, password: string, organizationName: string }} data
 */
export async function registerUser({ name, email, password, organizationName }) {
  const prisma = getPrismaClient();
  const normalizedEmail = normalizeEmail(email);

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new ConflictError('An account with this email already exists');

  // Hash password with Argon2id
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  // Create organization slug from name
  const slug = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

  const uniqueSlug = `${slug}-${randomBase64url(4)}`;

  // Create org, user, default workspace, settings, and billing in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: organizationName,
        slug: uniqueSlug,
        plan: 'FREE',
      },
    });

    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        email: normalizedEmail,
        passwordHash,
        name,
        role: 'OWNER',
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Default Workspace',
        isDefault: true,
      },
    });

    await tx.workspaceUser.create({
      data: { userId: user.id, workspaceId: workspace.id, role: 'ADMIN' },
    });

    await tx.organizationSettings.create({
      data: { organizationId: org.id },
    });

    await tx.billing.create({
      data: { organizationId: org.id, plan: 'FREE' },
    });

    return { user, org, workspace };
  });

  logger.info({ userId: result.user.id, orgId: result.org.id }, 'User registered');

  return { userId: result.user.id, organizationId: result.org.id };
}

/**
 * Authenticates a user and returns access + refresh tokens.
 * @param {{ email: string, password: string }} credentials
 * @param {string} ipAddress
 */
export async function loginUser({ email, password }, ipAddress) {
  const prisma = getPrismaClient();
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true, email: true, name: true, role: true,
      passwordHash: true, isActive: true, organizationId: true,
    },
  });

  // Constant-time: verify hash even if user not found to prevent timing attacks
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$invalidhash';
  const isValid = user
    ? await argon2.verify(user.passwordHash, password, ARGON2_OPTIONS)
    : await argon2.verify(dummyHash, password, ARGON2_OPTIONS).catch(() => false);

  if (!user || !isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated. Contact your administrator.');
  }

  // Get workspace IDs for the user
  const workspaceUsers = await prisma.workspaceUser.findMany({
    where: { userId: user.id },
    select: { workspaceId: true },
  });
  const workspaceIds = workspaceUsers.map((w) => w.workspaceId);

  // Issue tokens
  const { accessToken, refreshToken } = await issueTokens(user, workspaceIds);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info({ userId: user.id, ip: ipAddress }, 'User logged in');

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

/**
 * Revokes an access token (adds to Redis revocation list).
 * @param {string} token
 */
export async function logoutUser(token) {
  // Add last 16 chars of token to revocation list
  const tokenId = token.slice(-16);
  // Expire after max token lifetime (access token is 15m, use 20m for safety)
  await getRedisClient().setex(`revoked:${tokenId}`, 1200, '1');
}

/**
 * Changes a user's password.
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) throw new NotFoundError('User', userId);

  const isValid = await argon2.verify(user.passwordHash, currentPassword, ARGON2_OPTIONS);
  if (!isValid) throw new UnauthorizedError('Current password is incorrect');

  const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Invalidate cached user
  await cacheDel(CacheKeys.user(userId));

  logger.info({ userId }, 'Password changed');
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

async function issueTokens(user, workspaceIds) {
  const privateKey = await getPrivateKey();

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.organizationId,
    workspaceIds,
  };

  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(JWT_ACCESS_TOKEN_EXPIRY)
    .sign(privateKey);

  const refreshToken = await new SignJWT({ sub: user.id, type: 'refresh' })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(JWT_REFRESH_TOKEN_EXPIRY)
    .sign(privateKey);

  return { accessToken, refreshToken };
}
