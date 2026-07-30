/**
 * AlertMind — Formatter Utilities
 * Data formatting functions used across modules and report generation.
 */

/**
 * Formats a confidence score (0-1) as a percentage string.
 * @param {number} confidence
 * @returns {string} e.g. "87%"
 */
export function formatConfidence(confidence) {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Formats severity with consistent capitalization.
 * @param {string} severity
 * @returns {string}
 */
export function formatSeverity(severity) {
  const map = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    INFORMATIONAL: 'Informational',
  };
  return map[severity?.toUpperCase()] || severity || 'Unknown';
}

/**
 * Formats processing time in human-readable form.
 * @param {number} ms - Milliseconds
 * @returns {string} e.g. "45.2s" or "1m 23s"
 */
export function formatProcessingTime(ms) {
  if (!ms) return 'N/A';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Formats a MITRE technique ID with display name.
 * @param {string} id
 * @param {string} name
 * @returns {string} e.g. "T1059.001 — Command and Scripting Interpreter: PowerShell"
 */
export function formatMitreTechnique(id, name) {
  return `${id} — ${name}`;
}

/**
 * Truncates a string to a max length with ellipsis.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Formats file size in human-readable form.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Formats a date as ISO string with timezone indication.
 * @param {Date | string} date
 * @returns {string}
 */
export function formatTimestamp(date) {
  if (!date) return 'Unknown';
  try {
    return new Date(date).toISOString();
  } catch {
    return String(date);
  }
}

/**
 * Formats an SLA recommendation into a human-readable string.
 * @param {string} level - P1_IMMEDIATE | P2_URGENT | P3_HIGH | P4_MEDIUM | P5_LOW
 * @param {number} hours
 * @returns {string}
 */
export function formatSLA(level, hours) {
  const labels = {
    P1_IMMEDIATE: 'P1 — Respond Immediately',
    P2_URGENT: 'P2 — Respond Within 4 Hours',
    P3_HIGH: 'P3 — Respond Within 8 Hours',
    P4_MEDIUM: 'P4 — Respond Within 24 Hours',
    P5_LOW: 'P5 — Review Within 7 Days',
  };
  return labels[level] || `Respond within ${hours}h`;
}

/**
 * Masks sensitive values for safe logging.
 * Preserves first and last 4 chars.
 * @param {string} value
 * @returns {string}
 */
export function maskSensitive(value) {
  if (!value || value.length < 10) return '[REDACTED]';
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;
}
