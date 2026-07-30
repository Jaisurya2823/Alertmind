/**
 * AlertMind — Connector Constants
 * Defines required config fields per connector type and sync behavior.
 */

export const SUPPORTED_CONNECTOR_TYPES = Object.freeze(['SPLUNK', 'ELASTIC']);

/**
 * Config field schemas per connector type — used for validation and
 * for rendering setup forms in the future admin UI.
 */
export const CONNECTOR_CONFIG_FIELDS = Object.freeze({
  SPLUNK: {
    required: ['baseUrl', 'token'],
    optional: ['indexes', 'searchQuery', 'verifySSL'],
    description: 'Splunk REST API — requires a read-only token (Settings → Tokens). Never use an admin token.',
  },
  ELASTIC: {
    required: ['baseUrl', 'apiKey'],
    optional: ['indexPattern', 'query', 'verifySSL'],
    description: 'Elasticsearch — requires a read-only API key scoped to your alert indices only.',
  },
});

/** Minimum and maximum allowed sync interval, in minutes */
export const MIN_SYNC_INTERVAL_MINUTES = 5;
export const MAX_SYNC_INTERVAL_MINUTES = 1440; // 24 hours
export const DEFAULT_SYNC_INTERVAL_MINUTES = 15;

/** How far back to look on the very first sync (no lastSyncAt yet) */
export const INITIAL_SYNC_LOOKBACK_MINUTES = 60;

/** Maximum alerts ingested per sync cycle — prevents runaway AI cost from a bad query */
export const MAX_ALERTS_PER_SYNC = 50;

/** HTTP timeout for connector API calls */
export const CONNECTOR_HTTP_TIMEOUT_MS = 20_000;

/** Maximum response size accepted from a connector API (protects against huge dumps) */
export const CONNECTOR_MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB

export const SYNC_STATUS = Object.freeze({
  IDLE: 'IDLE',
  SYNCING: 'SYNCING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});
