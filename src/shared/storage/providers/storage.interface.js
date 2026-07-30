/**
 * AlertMind — Storage Provider Interface
 * Both local.storage.js (default, no external service) and minio.storage.js
 * (for production/S3-compatible deployments) implement this shape.
 * Selected at runtime via STORAGE_PROVIDER env var — see storage.config.js.
 */

/**
 * @typedef {Object} StorageProvider
 * @property {(key: string, buffer: Buffer, contentType: string, metadata?: Record<string,string>) => Promise<void>} upload
 * @property {(key: string, expirySeconds: number) => Promise<string>} getDownloadUrl
 *   Returns a URL the client can use to download the object. For local storage
 *   this is an authenticated API path (auth enforced by report.routes.js), not
 *   a public presigned link — arguably safer by default than a leak-able URL.
 * @property {(key: string) => Promise<Buffer>} read
 *   Reads the object back into memory. Used by the local-storage download route.
 * @property {(key: string) => Promise<void>} remove
 * @property {() => Promise<void>} ensureReady
 *   Called once at startup — creates directories (local) or verifies bucket (MinIO).
 */

export {};
