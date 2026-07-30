/**
 * AlertMind — Outbound HTTP Client
 * Used by connector integrations (Splunk, Elastic, etc.)
 * Enforces timeouts, TLS verification, and request size limits.
 */

import logger from '../logger/logger.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates a URL is safe to call: correct protocol, not pointing at
 * cloud metadata endpoints. Customer-hosted Splunk/Elastic instances are
 * often on internal/VPC addresses by design, so private IPs are allowed —
 * but the well-known cloud metadata IP is always blocked.
 * @param {URL} parsedUrl
 */
function assertSafeUrl(parsedUrl) {
  const blockedHosts = ['169.254.169.254', 'metadata.google.internal'];
  if (blockedHosts.includes(parsedUrl.hostname)) {
    throw new Error(`Blocked request to cloud metadata endpoint: ${parsedUrl.hostname}`);
  }
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Insecure HTTP connection blocked in production: ${parsedUrl.hostname}`);
  }
}

/**
 * Makes an outbound JSON HTTP request with security controls.
 *
 * @param {string} url
 * @param {object} options
 * @param {string} [options.method]
 * @param {Record<string, string>} [options.headers]
 * @param {unknown} [options.body]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxResponseBytes]
 * @returns {Promise<{ status: number, headers: Headers, data: unknown }>}
 */
export async function httpRequest(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = MAX_RESPONSE_SIZE_BYTES,
  } = options;

  const parsedUrl = new URL(url);
  assertSafeUrl(parsedUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AlertMind/1.0',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    return await readResponse(response, parsedUrl, maxResponseBytes);
  } catch (err) {
    handleFetchError(err, timeoutMs, parsedUrl);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Makes an outbound form-urlencoded POST request.
 * Required for APIs that don't accept JSON bodies (e.g. Splunk's search/jobs endpoint).
 *
 * @param {string} url
 * @param {Record<string, string>} formData
 * @param {object} options
 * @param {Record<string, string>} [options.headers]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxResponseBytes]
 * @returns {Promise<{ status: number, headers: Headers, data: unknown }>}
 */
export async function httpPostForm(url, formData, options = {}) {
  const {
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = MAX_RESPONSE_SIZE_BYTES,
  } = options;

  const parsedUrl = new URL(url);
  assertSafeUrl(parsedUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const body = new URLSearchParams(formData).toString();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AlertMind/1.0',
        ...headers,
      },
      body,
      signal: controller.signal,
    });

    return await readResponse(response, parsedUrl, maxResponseBytes);
  } catch (err) {
    handleFetchError(err, timeoutMs, parsedUrl);
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponse(response, parsedUrl, maxResponseBytes) {
  const contentLength = parseInt(response.headers.get('content-length') || '0');
  if (contentLength > maxResponseBytes) {
    throw new Error(`Response too large: ${contentLength} bytes from ${parsedUrl.hostname}`);
  }

  const text = await response.text();
  if (text.length > maxResponseBytes) {
    throw new Error(`Response body too large from ${parsedUrl.hostname}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, headers: response.headers, data };
}

function handleFetchError(err, timeoutMs, parsedUrl) {
  if (err.name === 'AbortError') {
    throw new Error(`Request timed out after ${timeoutMs}ms: ${parsedUrl.hostname}`);
  }
  logger.warn({ err: err.message, url: parsedUrl.hostname }, 'Outbound HTTP request failed');
  throw err;
}

/**
 * GET request helper.
 */
export function httpGet(url, options = {}) {
  return httpRequest(url, { ...options, method: 'GET' });
}

/**
 * POST request helper (JSON body).
 */
export function httpPost(url, body, options = {}) {
  return httpRequest(url, { ...options, method: 'POST', body });
}
