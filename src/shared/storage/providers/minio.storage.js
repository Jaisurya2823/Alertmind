/**
 * AlertMind — MinIO Storage Provider
 * S3-compatible object storage — opt-in via STORAGE_PROVIDER=minio.
 * Not required for local development or small deployments; use local.storage.js
 * (the default) unless you specifically need shared storage across multiple
 * horizontally-scaled app replicas.
 */

import { Client as MinioClient } from 'minio';
import { getConfig } from '../../../config/env.js';
import logger from '../../logger/logger.js';

const config = getConfig();

/** @type {MinioClient | null} */
let _client = null;

function getClient() {
  if (!_client) {
    _client = new MinioClient({
      endPoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      useSSL: config.MINIO_USE_SSL,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
    });
  }
  return _client;
}

async function ensureReady() {
  const client = getClient();
  const bucket = config.MINIO_BUCKET;

  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');
    logger.info({ bucket }, 'MinIO bucket created');

    await client.setBucketLifecycle(bucket, {
      Rule: [
        { ID: 'expire-temp-uploads', Status: 'Enabled', Filter: { Prefix: 'temp/' }, Expiration: { Days: 7 } },
        { ID: 'expire-old-reports', Status: 'Enabled', Filter: { Prefix: 'reports/' }, Expiration: { Days: 90 } },
      ],
    });
  }
}

async function upload(key, buffer, contentType, metadata = {}) {
  const client = getClient();
  await client.putObject(config.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': contentType,
    ...metadata,
  });
}

async function getDownloadUrl(key, expirySeconds) {
  const client = getClient();
  return client.presignedGetObject(config.MINIO_BUCKET, key, expirySeconds);
}

async function read(key) {
  const client = getClient();
  const stream = await client.getObject(config.MINIO_BUCKET, key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function remove(key) {
  const client = getClient();
  await client.removeObject(config.MINIO_BUCKET, key);
}

export const minioStorageProvider = {
  ensureReady,
  upload,
  getDownloadUrl,
  read,
  remove,
};
