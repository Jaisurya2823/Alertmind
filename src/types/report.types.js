/**
 * AlertMind — Report Type Definitions (JSDoc)
 */

/**
 * @typedef {Object} ReportContent
 * @property {string} executiveSummary - For non-technical leadership
 * @property {string} technicalSummary - For senior security engineers
 * @property {string} markdownContent - Full structured report in Markdown
 * @property {string} [htmlContent] - Rendered HTML version
 * @property {string} [pdfStoragePath] - MinIO storage key for PDF
 */

/**
 * @typedef {Object} ExportResult
 * @property {string} storageKey
 * @property {string} presignedUrl
 * @property {number} expiresIn - Seconds until URL expires
 */

export {};
