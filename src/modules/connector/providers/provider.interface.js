/**
 * AlertMind — Connector Provider Interface
 * Every provider (Splunk, Elastic, future: Defender, CrowdStrike) implements this shape.
 * Enforced by convention + JSDoc, checked at registration time in provider.registry.js.
 *
 * SECURITY CONTRACT:
 * - testConnection() and fetchAlerts() must NEVER perform write operations
 * - Config objects must never be logged in full (may contain tokens)
 * - All outbound calls must go through httpClient.js (enforces timeout, size limits, HTTPS)
 */

/**
 * @typedef {Object} NormalizedConnectorAlert
 * @property {string} rawInput - The raw event/alert content, stringified
 * @property {string} externalId - The source system's unique ID for this event (for dedup)
 * @property {string} [timestamp] - ISO 8601 timestamp if available
 */

/**
 * @typedef {Object} TestConnectionResult
 * @property {boolean} success
 * @property {string} message - Human-readable result (never includes the credential)
 * @property {Record<string, unknown>} [details] - Non-sensitive metadata (e.g. Splunk version)
 */

/**
 * @typedef {Object} ConnectorProvider
 * @property {(config: Record<string, unknown>) => Promise<TestConnectionResult>} testConnection
 *   Verifies the connector can authenticate and read data. Must not modify anything.
 * @property {(config: Record<string, unknown>, since: Date) => Promise<NormalizedConnectorAlert[]>} fetchAlerts
 *   Pulls alerts/events created after `since`. Must cap results to MAX_ALERTS_PER_SYNC.
 */

export {};
