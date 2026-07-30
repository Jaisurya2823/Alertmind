/**
 * AlertMind — Splunk Connector Provider
 * Real integration with the Splunk REST API using a read-only auth token.
 *
 * SECURITY: This provider only ever calls GET /services/server/info (health check)
 * and POST /services/search/jobs in "oneshot" mode (a read-only search execution).
 * It never writes, deletes, or modifies anything in the customer's Splunk instance.
 *
 * Required Splunk-side setup (documented for the customer):
 *   Settings → Tokens → New Token, scoped to a role with only "search" capability.
 *   Do NOT use an admin token.
 */

import { httpGet, httpPostForm } from '../../../shared/http/httpClient.js';
import { CONNECTOR_HTTP_TIMEOUT_MS, CONNECTOR_MAX_RESPONSE_BYTES, MAX_ALERTS_PER_SYNC } from '../connector.constants.js';
import logger from '../../../shared/logger/logger.js';

/**
 * @param {Record<string, unknown>} config
 * @returns {import('./provider.interface.js').TestConnectionResult}
 */
export async function testConnection(config) {
  const { baseUrl, token } = config;

  try {
    const { status, data } = await httpGet(`${trimTrailingSlash(baseUrl)}/services/server/info?output_mode=json`, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: CONNECTOR_HTTP_TIMEOUT_MS,
      maxResponseBytes: CONNECTOR_MAX_RESPONSE_BYTES,
    });

    if (status === 401 || status === 403) {
      return { success: false, message: 'Authentication failed — check the token has not expired or been revoked.' };
    }
    if (status !== 200) {
      return { success: false, message: `Splunk returned unexpected status ${status}` };
    }

    const version = data?.entry?.[0]?.content?.version;
    return {
      success: true,
      message: 'Connected successfully.',
      details: version ? { splunkVersion: version } : undefined,
    };
  } catch (err) {
    logger.warn({ err: err.message, host: safeHost(baseUrl) }, 'Splunk test connection failed');
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Fetches events from Splunk created since the given date.
 * Uses "oneshot" search execution — runs and returns results in a single
 * request without leaving a background search job running on the server.
 *
 * @param {Record<string, unknown>} config
 * @param {Date} since
 * @returns {Promise<import('./provider.interface.js').NormalizedConnectorAlert[]>}
 */
export async function fetchAlerts(config, since) {
  const { baseUrl, token, indexes, searchQuery } = config;

  const spl = buildSearchQuery({ indexes, searchQuery });
  const earliestTime = Math.floor(since.getTime() / 1000);

  const { status, data } = await httpPostForm(
    `${trimTrailingSlash(baseUrl)}/services/search/jobs`,
    {
      search: spl,
      output_mode: 'json',
      exec_mode: 'oneshot',
      earliest_time: String(earliestTime),
      latest_time: 'now',
      count: String(MAX_ALERTS_PER_SYNC),
    },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: CONNECTOR_HTTP_TIMEOUT_MS,
      maxResponseBytes: CONNECTOR_MAX_RESPONSE_BYTES,
    }
  );

  if (status !== 200) {
    throw new Error(`Splunk search failed with status ${status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
  }

  const results = Array.isArray(data?.results) ? data.results : [];

  return results.slice(0, MAX_ALERTS_PER_SYNC).map((event) => ({
    rawInput: JSON.stringify(event, null, 2),
    externalId: event._cd || event._bkt || hashEvent(event),
    timestamp: event._time || null,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSearchQuery({ indexes, searchQuery }) {
  if (searchQuery?.trim()) {
    // User-supplied SPL — must already start with "search" or a generating command
    return searchQuery.trim();
  }
  if (Array.isArray(indexes) && indexes.length > 0) {
    const indexClause = indexes.map((i) => `index=${spEscape(i)}`).join(' OR ');
    return `search (${indexClause})`;
  }
  // Safe default: search notable/alert-tagged events only, avoid scanning all indexes
  return 'search index=* tag=alert';
}

function spEscape(value) {
  // Strip characters that could break out of the SPL index= clause
  return String(value).replace(/[^a-zA-Z0-9_\-*]/g, '');
}

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-url';
  }
}

function hashEvent(event) {
  // Fallback dedup key when Splunk doesn't provide _cd (rare)
  return Buffer.from(JSON.stringify(event)).toString('base64').slice(0, 32);
}
