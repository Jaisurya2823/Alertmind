/**
 * AlertMind — Redis Configuration (ioredis)
 * Used by: BullMQ, rate-limit-redis, session store, cache
 * ioredis required (not generic redis) for BullMQ compatibility
 */

import Redis from 'ioredis';
import { getConfig } from './env.js';
import logger from '../shared/logger/logger.js';

const config = getConfig();

/** @type {Redis | null} */
let _client = null;

/** @type {Redis | null} */
let _subscriberClient = null;

/**
 * Redis connection options
 * lazyConnect: true — connect explicitly via connectRedis(), not on import
 */
function buildRedisOptions() {
  /** @type {import('ioredis').RedisOptions} */
  const options = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error({ times }, 'Redis: max reconnection attempts reached');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn({ times, delay }, 'Redis: reconnecting');
      return delay;
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
    connectTimeout: 10_000,
    commandTimeout: 5_000,
    keepAlive: 30_000,
    noDelay: true,
    db: 0,
  };

  if (config.REDIS_TLS) {
    options.tls = {
      rejectUnauthorized: true,
    };
  }

  return options;
}

/**
 * Returns the singleton Redis client.
 * Call connectRedis() before using this.
 * @returns {Redis}
 */
export function getRedisClient() {
  if (!_client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return _client;
}

/**
 * Returns a separate Redis client for pub/sub.
 * BullMQ needs dedicated connections for subscriber use.
 * @returns {Redis}
 */
export function getSubscriberClient() {
  if (!_subscriberClient) {
    throw new Error('Redis subscriber client not initialized.');
  }
  return _subscriberClient;
}

/**
 * Establishes Redis connection and verifies with PING.
 * Called during server bootstrap.
 */
export async function connectRedis() {
  const options = buildRedisOptions();

  _client = new Redis(options);
  _subscriberClient = new Redis({ ...options, lazyConnect: true });

  // Attach event listeners before connecting
  _client.on('error', (err) => logger.error({ err }, 'Redis client error'));
  _client.on('close', () => logger.warn('Redis connection closed'));
  _client.on('reconnecting', (delay) => logger.info({ delay }, 'Redis reconnecting'));

  _subscriberClient.on('error', (err) =>
    logger.error({ err }, 'Redis subscriber error')
  );

  await _client.connect();
  await _subscriberClient.connect();

  // Verify connection
  const pong = await _client.ping();
  if (pong !== 'PONG') {
    throw new Error(`Redis PING failed — got: ${pong}`);
  }
}

/**
 * Cleanly disconnects Redis clients.
 * Called during graceful shutdown.
 */
export async function disconnectRedis() {
  if (_client) {
    await _client.quit();
    _client = null;
  }
  if (_subscriberClient) {
    await _subscriberClient.quit();
    _subscriberClient = null;
  }
}

/**
 * Returns a new Redis connection for BullMQ.
 * BullMQ requires each queue/worker to have its own connection.
 * @returns {Redis}
 */
export function createBullMQConnection() {
  const opts = buildRedisOptions();
  // BullMQ manages its own connection lifecycle
  opts.lazyConnect = false;
  opts.maxRetriesPerRequest = null; // Required by BullMQ
  return new Redis(opts);
}
