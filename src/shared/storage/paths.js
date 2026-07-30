/**
 * AlertMind — Storage Path Builders
 * All MinIO object keys defined here — single source of truth.
 */

export const StoragePaths = Object.freeze({
  /** PDF report storage key */
  reportPdf: (investigationId) => `reports/${investigationId}/incident-report.pdf`,

  /** Uploaded alert file (archived for audit trail) */
  uploadedAlert: (alertId, filename) => `uploads/${alertId}/${filename}`,

  /** Temp file during processing */
  tempFile: (filename) => `temp/${filename}`,

  /** Exported investigation bundle */
  exportBundle: (investigationId, format) => `exports/${investigationId}/investigation.${format}`,
});
