/**
 * AlertMind — Authentication Middleware
 * Validates JWT (RS256) from Authorization header or checks API key from X-Api-Key header.
 * Attaches req.user on success.
 */

import { jwtVerify, importSPKI } from 'jose';
import { getConfig } from '../../config/env.js';
import { getPrismaClient } from '../../bootstrap/startup.js';
import { getRedisClient } from '../../config/redis.config.js';
import { UnauthorizedError } from '../../shared/errors/app.error.js';
import { cacheAside } from '../../shared/cache/cache.js';
import { CacheKeys, CacheTTL } from '../../shared/cache/cacheKeys.js';
import { sha256 } from '../../shared/crypto/crypto.js';
import { JWT_ALGORITHM, JWT_ISSUER, JWT_AUDIENCE } from '../../shared/constants/security.constants.js';
import logger from '../../shared/logger/logger.js';

const config = getConfig();

// Cache the parsed public key to avoid re-parsing on every request
let _publicKey = null;
async function getPublicKey() {
  if (_publicKey) return _publicKey;
  const pem = config.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  _publicKey = await importSPKI(pem, JWT_ALGORITHM);
  return _publicKey;
}

/**
 * Middleware that requires a valid JWT or API key.
 * Attaches req.user = { id, email, role, organizationId } on success.
 */
export async function requireAuth(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];

    if (apiKey) {
      req.user = await authenticateApiKey(apiKey);
      req.authMethod = 'api_key';
      return next();
    }

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      req.user = await authenticateJWT(token);
      req.authMethod = 'jwt';
      return next();
    }

    throw new UnauthorizedError('Authentication required. Provide a Bearer token or X-Api-Key header.');
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies a JWT and returns the user payload.
 * @param {string} token
 */
async function authenticateJWT(token) {
  let payload;
  try {
    const publicKey = await getPublicKey();
    const result = await jwtVerify(token, publicKey, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    payload = result.payload;
  } catch (err) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      throw new UnauthorizedError('Token has expired. Please log in again.');
    }
    throw new UnauthorizedError('Invalid authentication token.');
  }

  // Check token is not in Redis revocation list
  const revoked = await getRedisClient().get(`revoked:${token.slice(-16)}`);
  if (revoked) {
    throw new UnauthorizedError('Token has been revoked. Please log in again.');
  }

  // Return user context from token claims
  if (!payload.sub || !payload.email || !payload.role || !payload.orgId) {
    throw new UnauthorizedError('Malformed authentication token.');
  }

  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    organizationId: payload.orgId,
    workspaceIds: payload.workspaceIds || [],
  };
}

/**
 * Verifies an API key and returns the associated organization context.
 * @param {string} rawKey
 */
async function authenticateApiKey(rawKey) {
  const keyHash = sha256(rawKey);

  // Cache API key lookups — they're expensive (DB + hash compare)
  const cachedKey = await cacheAside(
    CacheKeys.apiKey(keyHash),
    CacheTTL.MEDIUM,
    async () => {
      const prisma = getPrismaClient();
      return prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          organization: {
            select: { id: true, isActive: true },
          },
        },
      });
    }
  );

  if (!cachedKey) {
    throw new UnauthorizedError('Invalid API key.');
  }

  if (!cachedKey.isActive) {
    throw new UnauthorizedError('API key has been revoked.');
  }

  if (cachedKey.expiresAt && new Date(cachedKey.expiresAt) < new Date()) {
    throw new UnauthorizedError('API key has expired.');
  }

  if (!cachedKey.organization?.isActive) {
    throw new UnauthorizedError('Organization account is not active.');
  }

  // Update lastUsedAt asynchronously — don't block the request
  getPrismaClient()
    .apiKey.update({
      where: { keyHash },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => logger.warn({ err }, 'Failed to update API key lastUsedAt'));

  return {
    id: null, // API keys are org-level, not user-level
    email: null,
    role: 'ADMIN', // API keys have admin-level access within the org
    organizationId: cachedKey.organizationId,
    permissions: cachedKey.permissions,
    authType: 'api_key',
  };
}
