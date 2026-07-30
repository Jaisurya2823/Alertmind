/**
 * AlertMind — Alert Format Auto-Detection
 * Detects alert format from raw input using structural heuristics.
 * Used when the user hasn't specified the format explicitly.
 */

import { ALERT_FORMAT } from '../../shared/constants/app.constants.js';

/**
 * Detects the alert format from raw input string.
 * Uses structural heuristics — order matters (most specific first).
 *
 * @param {string} raw
 * @returns {keyof typeof ALERT_FORMAT}
 */
export function detectAlertFormat(raw) {
  if (!raw || typeof raw !== 'string') return ALERT_FORMAT.PLAIN_TEXT;

  const trimmed = raw.trim();

  // ─── Sysmon / Windows Event XML ─────────────────────────────────────────
  if (
    trimmed.includes('<Event xmlns=') ||
    trimmed.includes('<EventID>') ||
    trimmed.includes('<System>') ||
    (trimmed.startsWith('<') && trimmed.includes('</Event>'))
  ) {
    if (trimmed.includes('Microsoft-Windows-Sysmon')) return ALERT_FORMAT.SYSMON;
    return ALERT_FORMAT.WINDOWS_EVENT;
  }

  // ─── Sigma Rule ──────────────────────────────────────────────────────────
  if (
    trimmed.includes('title:') &&
    trimmed.includes('detection:') &&
    trimmed.includes('logsource:')
  ) {
    return ALERT_FORMAT.SIGMA;
  }

  // ─── JSON ────────────────────────────────────────────────────────────────
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return detectJsonVendor(parsed);
    } catch {
      // Not valid JSON — fall through
    }
  }

  // ─── CSV ─────────────────────────────────────────────────────────────────
  const lines = trimmed.split('\n');
  if (lines.length > 1) {
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    if (commaCount >= 3 && lines.every((l) => (l.match(/,/g) || []).length === commaCount)) {
      return ALERT_FORMAT.CSV;
    }
  }

  // ─── Syslog (RFC 3164 / RFC 5424) ────────────────────────────────────────
  if (
    /^<\d{1,3}>/.test(trimmed) || // RFC 3164: <PRI>
    /^\d{4}-\d{2}-\d{2}T/.test(trimmed) || // ISO timestamp
    /^[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}/.test(trimmed) // BSD syslog
  ) {
    if (trimmed.includes('ossec') || trimmed.includes('wazuh')) return ALERT_FORMAT.WAZUH;
    return ALERT_FORMAT.SYSLOG;
  }

  return ALERT_FORMAT.PLAIN_TEXT;
}

/**
 * Identifies the vendor from a parsed JSON object.
 * @param {Record<string, unknown>} parsed
 * @returns {keyof typeof ALERT_FORMAT}
 */
function detectJsonVendor(parsed) {
  const str = JSON.stringify(parsed).toLowerCase();

  if (
    str.includes('microsoftdefender') ||
    str.includes('microsoft defender') ||
    str.includes('windowsdefender') ||
    str.includes('detectiontimeutc')
  ) return ALERT_FORMAT.DEFENDER;

  if (
    str.includes('crowdstrike') ||
    str.includes('falcon') ||
    (parsed.event_type && str.includes('falcon'))
  ) return ALERT_FORMAT.CROWDSTRIKE;

  if (
    str.includes('sentinelone') ||
    str.includes('sentinel one') ||
    str.includes('s1agentid')
  ) return ALERT_FORMAT.SENTINELONE;

  if (str.includes('"wazuh"') || str.includes('wazuh_rule') || str.includes('wazuhmanager')) {
    return ALERT_FORMAT.WAZUH;
  }

  if (str.includes('"_source"') && (str.includes('"agent"') || str.includes('"event.kind"'))) {
    return ALERT_FORMAT.ELASTIC;
  }

  if (str.includes('"result"') && str.includes('"sourcetype"') && str.includes('"splunk"')) {
    return ALERT_FORMAT.SPLUNK;
  }

  return ALERT_FORMAT.JSON;
}

/**
 * Returns a human-readable name for a format enum value.
 * @param {string} format
 * @returns {string}
 */
export function getFormatDisplayName(format) {
  const names = {
    JSON: 'JSON',
    SYSLOG: 'Syslog',
    WINDOWS_EVENT: 'Windows Event Log',
    SYSMON: 'Sysmon',
    SIGMA: 'Sigma Rule',
    WAZUH: 'Wazuh Alert',
    SPLUNK: 'Splunk Alert',
    ELASTIC: 'Elastic Alert',
    DEFENDER: 'Microsoft Defender Alert',
    CROWDSTRIKE: 'CrowdStrike Alert',
    SENTINELONE: 'SentinelOne Alert',
    PLAIN_TEXT: 'Plain Text',
    CSV: 'CSV',
  };
  return names[format] || format;
}
