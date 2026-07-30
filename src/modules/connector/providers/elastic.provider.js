/**
 * AlertMind — Elastic Connector Provider
 * Real integration with the Elasticsearch REST API using a read-only API key.
 *
 * SECURITY: This provider only ever calls GET /_cluster/health (health check)
 * and POST /<index>/_search (a read-only query). It never writes, deletes,
 * or modifies any index.
 *
 * Required Elastic-side setup (documented for the customer):
 *   Stack Management → API Keys → Create, with privileges restricted to
 *   `read` on the specific index pattern you want AlertMind to poll.
 */

import { httpGet, httpPost } from '../../../shared/http/httpClient.js';
import { CONNECTOR_HTTP_TIMEOUT_MS, CONNECTOR_MAX_RESPONSE_BYTES, MAX_ALERTS_PER_SYNC } from '../connector.constants.js';
import logger from '../../../shared/logger/logger.js';

/**
 * @param {Record<string, unknown>} config
 * @returns {import('./provider.interface.js').TestConnectionResult}
 */
export async function testConnection(config) {
  const { baseUrl, apiKey } = config;

  try {
    const { status, data } = await httpGet(`${trimTrailingSlash(baseUrl)}/_cluster/health`, {
      headers: { Authorization: `ApiKey ${apiKey}` },
      timeoutMs: CONNECTOR_HTTP_TIMEOUT_MS,
      maxResponseBytes: CONNECTOR_MAX_RESPONSE_BYTES,
    });

    if (status === 401 || status === 403) {
      return { success: false, message: 'Authentication failed — check the API key has not expired or been revoked.' };
    }
    if (status !== 200) {
      return { success: false, message: `Elasticsearch returned unexpected status ${status}` };
    }

    return {
      success: true,
      message: 'Connected successfully.',
      details: data?.cluster_name ? { clusterName: data.cluster_name, status: data.status } : undefined,
    };
  } catch (err) {
    logger.warn({ err: err.message, host: safeHost(baseUrl) }, 'Elastic test connection failed');
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Fetches documents from Elasticsearch created since the given date.
 * @param {Record<string, unknown>} config
 * @param {Date} since
 * @returns {Promise<import('./provider.interface.js').NormalizedConnectorAlert[]>}
 */
export async function fetchAlerts(config, since) {
  const { baseUrl, apiKey, indexPattern, query } = config;

  const timeFilter = {
    range: { '@timestamp': { gte: since.toISOString() } },
  };

  const boolQuery = query
    ? { bool: { must: [query], filter: [timeFilter] } }
    : { bool: { filter: [timeFilter] } };

  const searchBody = {
    query: boolQuery,
    size: MAX_ALERTS_PER_SYNC,
    sort: [{ '@timestamp': 'asc' }],
  };

  const index = indexPattern || 'logs-*';
  const { status, data } = await httpPost(
    `${trimTrailingSlash(baseUrl)}/${encodeURIComponent(index)}/_search`,
    searchBody,
    {
      headers: { Authorization: `ApiKey ${apiKey}` },
      timeoutMs: CONNECTOR_HTTP_TIMEOUT_MS,
      maxResponseBytes: CONNECTOR_MAX_RESPONSE_BYTES,
    }
  );

  if (status !== 200) {
    throw new Error(`Elasticsearch query failed with status ${status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
  }

  const hits = data?.hits?.hits || [];

  return hits.slice(0, MAX_ALERTS_PER_SYNC).map((hit) => ({
    rawInput: JSON.stringify(hit._source, null, 2),
    externalId: hit._id,
    timestamp: hit._source?.['@timestamp'] || null,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
