/**
 * AlertMind — Storage Abstraction
 * Wraps MinIO operations with consistent error handling and path management.
 */

import { uploadToStorage, getPresignedDownloadUrl, deleteFromStorage } from '../../config/storage.config.js';
import { StoragePaths } from './paths.js';
import logger from '../logger/logger.js';

/**
 * Stores a generated PDF report in MinIO.
 * @param {string} investigationId
 * @param {Buffer} pdfBuffer
 * @returns {Promise<string>} storage key
 */
export async function storeReport(investigationId, pdfBuffer) {
  const key = StoragePaths.reportPdf(investigationId);
  await uploadToStorage(key, pdfBuffer, 'application/pdf', {
    'investigation-id': investigationId,
    'generated-at': new Date().toISOString(),
  });
  logger.info({ key, size: pdfBuffer.length }, 'Report PDF stored');
  return key;
}

/**
 * Gets a presigned download URL for a stored report.
 * @param {string} storageKey
 * @param {number} expirySeconds
 */
export async function getReportDownloadUrl(storageKey, expirySeconds = 3600) {
  return getPresignedDownloadUrl(storageKey, expirySeconds);
}

/**
 * Deletes a stored file (e.g., temp upload, old report).
 * @param {string} storageKey
 */
export async function deleteStoredFile(storageKey) {
  try {
    await deleteFromStorage(storageKey);
    logger.info({ key: storageKey }, 'Stored file deleted');
  } catch (err) {
    logger.warn({ err, key: storageKey }, 'Failed to delete stored file');
  }
}
