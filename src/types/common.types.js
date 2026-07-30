/**
 * AlertMind — Common Type Definitions (JSDoc)
 * Type documentation for VS Code IntelliSense and IDE tooling.
 * AlertMind uses JavaScript — these are not compiled type files.
 */

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 * @property {'OWNER'|'ADMIN'|'ANALYST'|'VIEWER'} role
 * @property {string} organizationId
 * @property {string[]} [workspaceIds]
 * @property {string[]} [permissions]
 * @property {'jwt'|'api_key'} [authType]
 */

/**
 * @typedef {Object} PipelineContext
 * @property {string} investigationId
 * @property {string} alertId
 * @property {string} rawInput
 * @property {Record<string, unknown>} parsedAlert
 * @property {Array<{type: string, value: string, confidence: number}>} entities
 * @property {Array<{techniqueId: string, techniqueName: string, confidence: number}>} mitreMappings
 * @property {Array<{text: string, confidence: number}>} hypotheses
 * @property {Record<string, unknown>} riskAssessment
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} page
 * @property {number} limit
 * @property {string} [sortBy]
 * @property {'asc'|'desc'} [sortOrder]
 */

/**
 * @typedef {Object} PaginatedResult
 * @template T
 * @property {T[]} items
 * @property {number} total
 */

/**
 * @typedef {Object} JobResult
 * @property {string} investigationId
 * @property {'COMPLETED'|'FAILED'} status
 */

export {};
