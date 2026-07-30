/**
 * AlertMind — Local Filesystem Storage Provider
 * Default storage backend — no Docker, no cloud account, no external service.
 * Files are written under STORAGE_LOCAL_PATH (default: ./storage/objects).
 *
 * Download URLs are authenticated API paths (/api/v1/reports/:id/pdf/download),
 * not public presigned links — the browser sends the user's Bearer token like
 * any other API call. This is actually a stronger default than MinIO's
 * presigned URLs, which are valid for anyone who has the link.
 *
 * Trade-off vs MinIO: files live on this machine's disk only. Fine for a
 * single-server deployment; for true horizontal scaling (multiple app
 * replicas without shared storage) switch STORAGE_PROVIDER=minio.
 */

import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { getConfig } from '../../../config/env.js';
import logger from '../../logger/logger.js';

const config = getConfig();
const ROOT = resolve(config.STORAGE_LOCAL_PATH || './storage/objects');

/**
 * Resolves a storage key to an absolute filesystem path.
 * Rejects any key that would escape ROOT via path traversal (../).
 * @param {string} key
 * @returns {string}
 */
function resolveSafePath(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Storage key must be a non-empty string');
  }
  const target = resolve(ROOT, key);
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    throw new Error(`Storage key resolves outside the storage root: ${key}`);
  }
  return target;
}

async function ensureReady() {
  await mkdir(ROOT, { recursive: true });
  logger.info({ path: ROOT }, 'Local storage provider ready');
}

/**
 * @param {string} key
 * @param {Buffer} buffer
 * @param {string} _contentType - unused for local disk; kept for interface parity
 * @param {Record<string,string>} [_metadata] - unused for local disk
 */
async function upload(key, buffer, _contentType, _metadata) {
  const path = resolveSafePath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  logger.debug({ key, bytes: buffer.length }, 'File written to local storage');
}

/**
 * Returns a marker confirming the file exists. report.service.js turns this
 * into a proper authenticated API path using the investigation ID it already
 * has — local mode is auth-gated per request, not time-gated via a signed URL.
 * @param {string} key
 * @param {number} _expirySeconds - unused for local mode
 */
async function getDownloadUrl(key, _expirySeconds) {
  const path = resolveSafePath(key);
  if (!existsSync(path)) {
    throw new Error(`File not found in local storage: ${key}`);
  }
  return `local:${key}`;
}

async function read(key) {
  const path = resolveSafePath(key);
  return readFile(path);
}

async function remove(key) {
  const path = resolveSafePath(key);
  await unlink(path).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
  });
}

export const localStorageProvider = {
  ensureReady,
  upload,
  getDownloadUrl,
  read,
  remove,
};
