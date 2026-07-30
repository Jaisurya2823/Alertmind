/**
 * AlertMind — Redis Cache
 * Typed get/set/del/invalidate with TTL, key namespacing, and Prometheus metrics
 */

import { getRedisClient } from '../../config/redis.config.js';
import logger from '../logger/logger.js';
import { cacheHitTotal, cacheMissTotal } from '../metrics/metrics.js';

/**
 * Gets a cached value by key.
 * Returns null on miss or error (fail-open — never block on cache errors).
 * @template T
 * @param {string} key
 * @returns {Promise<T | null>}
 */
export async function cacheGet(key) {
  try {
    const raw = await getRedisClient().get(key);
    if (raw === null) {
      cacheMissTotal.inc({ key_prefix: extractPrefix(key) });
      return null;
    }
    cacheHitTotal.inc({ key_prefix: extractPrefix(key) });
    return JSON.parse(raw);
  } catch (err) {
    logger.warn({ err, key }, 'Cache GET failed — treating as miss');
    return null;
  }
}

/**
 * Sets a value in cache with TTL.
 * @param {string} key
 * @param {unknown} value - Must be JSON-serializable
 * @param {number} ttlSeconds
 */
export async function cacheSet(key, value, ttlSeconds) {
  try {
    await getRedisClient().setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn({ err, key }, 'Cache SET failed — continuing without cache');
  }
}

/**
 * Deletes a single key.
 * @param {string} key
 */
export async function cacheDel(key) {
  try {
    await getRedisClient().del(key);
  } catch (err) {
    logger.warn({ err, key }, 'Cache DEL failed');
  }
}

/**
 * Deletes all keys matching a pattern.
 * Uses SCAN — safe for production (does not block Redis like KEYS).
 * @param {string} pattern - e.g. 'investigation:*'
 */
export async function cacheInvalidatePattern(pattern) {
  try {
    const client = getRedisClient();
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    if (deleted > 0) {
      logger.debug({ pattern, deleted }, 'Cache invalidated');
    }
  } catch (err) {
    logger.warn({ err, pattern }, 'Cache pattern invalidation failed');
  }
}

/**
 * Cache-aside pattern helper.
 * Tries cache first; on miss, calls loader, caches result, and returns it.
 * @template T
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
export async function cacheAside(key, ttlSeconds, loader) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  if (fresh !== null && fresh !== undefined) {
    await cacheSet(key, fresh, ttlSeconds);
  }
  return fresh;
}

/**
 * Checks whether a key exists in cache.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function cacheExists(key) {
  try {
    const result = await getRedisClient().exists(key);
    return result === 1;
  } catch {
    return false;
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function extractPrefix(key) {
  return key.split(':')[0] || 'unknown';
}
