/**
 * AlertMind — Parser Helpers
 * Utility functions for parsing alert formats and decoding payloads.
 * Used by the AI agents and the normalizer.
 */

/**
 * Safely parses a JSON string. Returns null on failure.
 * @param {string} str
 * @returns {unknown | null}
 */
export function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Decodes a Base64 string to UTF-8 text.
 * Handles both standard and URL-safe Base64.
 * @param {string} base64
 * @returns {string | null}
 */
export function decodeBase64(base64) {
  try {
    // Normalize URL-safe Base64 to standard
    const standard = base64.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if missing
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Detects if a string is likely Base64 encoded.
 * @param {string} str
 * @returns {boolean}
 */
export function isLikelyBase64(str) {
  if (!str || str.length < 20) return false;
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str) && str.length % 4 === 0;
}

/**
 * Extracts all IPv4 addresses from a text string.
 * @param {string} text
 * @returns {string[]}
 */
export function extractIPv4Addresses(text) {
  const regex = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  return [...new Set(text.match(regex) || [])];
}

/**
 * Extracts all SHA-256 hashes from a text string.
 * @param {string} text
 * @returns {string[]}
 */
export function extractSHA256Hashes(text) {
  const regex = /\b[a-fA-F0-9]{64}\b/g;
  return [...new Set(text.match(regex) || [])];
}

/**
 * Extracts all MD5 hashes from a text string.
 * @param {string} text
 * @returns {string[]}
 */
export function extractMD5Hashes(text) {
  const regex = /\b[a-fA-F0-9]{32}\b/g;
  return [...new Set(text.match(regex) || [])];
}

/**
 * Extracts domain names from a text string.
 * @param {string} text
 * @returns {string[]}
 */
export function extractDomains(text) {
  const regex = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;
  return [...new Set(text.match(regex) || [])].filter((d) => !d.match(/^\d+\.\d+\.\d+\.\d+$/));
}

/**
 * Parses a Windows Event ID to its description.
 * @param {number} eventId
 * @returns {string}
 */
export function describeWindowsEventId(eventId) {
  const events = {
    4624: 'Account Logon Success',
    4625: 'Account Logon Failure',
    4648: 'Logon with Explicit Credentials',
    4688: 'Process Created',
    4689: 'Process Terminated',
    4698: 'Scheduled Task Created',
    4699: 'Scheduled Task Deleted',
    4720: 'User Account Created',
    4728: 'Member Added to Global Group',
    4732: 'Member Added to Local Group',
    4768: 'Kerberos Authentication Ticket Requested',
    4769: 'Kerberos Service Ticket Requested',
    4776: 'NTLM Authentication Attempted',
    1: 'Sysmon: Process Created',
    3: 'Sysmon: Network Connection',
    7: 'Sysmon: Image Loaded',
    8: 'Sysmon: CreateRemoteThread',
    10: 'Sysmon: ProcessAccess',
    11: 'Sysmon: FileCreate',
    12: 'Sysmon: RegistryEvent (Create/Delete)',
    13: 'Sysmon: RegistryEvent (Value Set)',
    15: 'Sysmon: FileCreateStreamHash',
    22: 'Sysmon: DNSEvent',
  };
  return events[eventId] || `Windows Event ID ${eventId}`;
}
