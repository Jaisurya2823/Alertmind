/**
 * AlertMind — Storage Configuration
 * Selects the active storage provider based on STORAGE_PROVIDER env var.
 *
 * STORAGE_PROVIDER=local (default) — writes to local disk, zero external
 *   services required. Right choice for a single-server deployment, and
 *   for anyone who doesn't want to run Docker/MinIO.
 * STORAGE_PROVIDER=minio — S3-compatible object storage, for deployments
 *   with multiple horizontally-scaled app replicas that need shared storage.
 */

import { getConfig } from './env.js';
import { localStorageProvider } from '../shared/storage/providers/local.storage.js';
import logger from '../shared/logger/logger.js';

const config = getConfig();

/** @type {import('../shared/storage/providers/storage.interface.js').StorageProvider | null} */
let _provider = null;

/**
 * Returns the active storage provider, loading it lazily.
 * MinIO's client library is only imported if STORAGE_PROVIDER=minio —
 * local-mode users never pull in that dependency at runtime.
 */
async function getProvider() {
  if (_provider) return _provider;

  if (config.STORAGE_PROVIDER === 'minio') {
    const { minioStorageProvider } = await import('../shared/storage/providers/minio.storage.js');
    _provider = minioStorageProvider;
  } else {
    _provider = localStorageProvider;
  }

  return _provider;
}

/**
 * Initializes the active storage provider. Called once at server startup.
 */
export async function ensureStorageReady() {
  const provider = await getProvider();
  await provider.ensureReady();
  logger.info({ provider: config.STORAGE_PROVIDER || 'local' }, 'Storage provider initialized');
}

/**
 * Uploads a buffer to storage under the given key.
 * @param {string} objectKey
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {Record<string, string>} [metadata]
 */
export async function uploadToStorage(objectKey, buffer, contentType, metadata = {}) {
  const provider = await getProvider();
  await provider.upload(objectKey, buffer, contentType, metadata);
}

/**
 * Returns a download reference for an object.
 * For local storage: a `local:<key>` marker — report.service.js converts
 * this into a proper authenticated API path.
 * For MinIO: a real presigned URL, usable directly.
 * @param {string} objectKey
 * @param {number} expirySeconds
 */
export async function getPresignedDownloadUrl(objectKey, expirySeconds = 3600) {
  const provider = await getProvider();
  return provider.getDownloadUrl(objectKey, expirySeconds);
}

/**
 * Reads an object back into memory — used by the local-storage download route.
 * @param {string} objectKey
 */
export async function readFromStorage(objectKey) {
  const provider = await getProvider();
  return provider.read(objectKey);
}

/**
 * Deletes an object from storage.
 * @param {string} objectKey
 */
export async function deleteFromStorage(objectKey) {
  const provider = await getProvider();
  await provider.remove(objectKey);
}

/**
 * Returns which provider is active — used by report.service.js to decide
 * whether to return a presigned URL directly or build an API download path.
 */
export function getActiveStorageProviderName() {
  return config.STORAGE_PROVIDER === 'minio' ? 'minio' : 'local';
}
