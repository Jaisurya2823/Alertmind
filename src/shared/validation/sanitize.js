/**
 * AlertMind — Input Sanitization
 * Sanitizes raw alert input before storage and AI processing.
 * Does NOT alter the security meaning of alerts — only strips dangerous artifacts.
 */

import { MAX_ALERT_CHARS_FOR_AI } from '../constants/ai.constants.js';
import { MAX_ALERT_RAW_INPUT_BYTES } from '../constants/security.constants.js';

/**
 * Sanitizes raw alert input string.
 * - Removes null bytes (common in malformed EVTX exports)
 * - Trims leading/trailing whitespace
 * - Enforces maximum length
 * - Strips prompt injection attempts from raw text
 *
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeAlertInput(raw) {
  if (typeof raw !== 'string') {
    throw new TypeError('Alert input must be a string');
  }

  let sanitized = raw;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove non-printable control characters (keep \n, \r, \t)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim
  sanitized = sanitized.trim();

  // Enforce byte limit (UTF-8 safe truncation)
  if (Buffer.byteLength(sanitized, 'utf8') > MAX_ALERT_RAW_INPUT_BYTES) {
    // Truncate to byte limit without splitting multi-byte chars
    sanitized = Buffer.from(sanitized, 'utf8')
      .subarray(0, MAX_ALERT_RAW_INPUT_BYTES)
      .toString('utf8')
      // Remove any incomplete multi-byte char at end
      .replace(/[\uFFFD\uD800-\uDFFF]$/, '');
  }

  return sanitized;
}

/**
 * Truncates alert input to the maximum length safe for AI processing.
 * If input is larger, truncates with a marker so the AI knows data was cut.
 *
 * @param {string} sanitized
 * @returns {string}
 */
export function truncateForAI(sanitized) {
  if (sanitized.length <= MAX_ALERT_CHARS_FOR_AI) return sanitized;

  const truncated = sanitized.slice(0, MAX_ALERT_CHARS_FOR_AI);
  return `${truncated}\n\n[TRUNCATED: Input exceeded ${MAX_ALERT_CHARS_FOR_AI} characters. Analysis based on first ${MAX_ALERT_CHARS_FOR_AI} characters only.]`;
}

/**
 * Sanitizes a free-text string for storage (user names, descriptions, etc.)
 * @param {string} input
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeText(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalizes an email address for storage and lookup.
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return email.toLowerCase().trim();
}
