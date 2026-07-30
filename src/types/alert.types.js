/**
 * AlertMind — Alert Type Definitions (JSDoc)
 */

/**
 * @typedef {'JSON'|'SYSLOG'|'WINDOWS_EVENT'|'SYSMON'|'SIGMA'|'WAZUH'|'SPLUNK'|'ELASTIC'|'DEFENDER'|'CROWDSTRIKE'|'SENTINELONE'|'PLAIN_TEXT'|'CSV'} AlertFormat
 */

/**
 * @typedef {'MICROSOFT_DEFENDER'|'CROWDSTRIKE'|'SENTINEL'|'SPLUNK'|'ELASTIC'|'WAZUH'|'AWS_GUARDDUTY'|'GCP_SCC'|'SENTINELONE'|'SURICATA'|'ZEEK'|'SYSMON'|'MANUAL'} AlertSource
 */

/**
 * @typedef {'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'|'ARCHIVED'} AlertStatus
 */

/**
 * @typedef {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFORMATIONAL'} Severity
 */

/**
 * @typedef {Object} AlertSubmission
 * @property {string} rawInput
 * @property {AlertFormat} [inputFormat]
 * @property {AlertSource} [source]
 * @property {string} workspaceId
 * @property {string} submittedBy
 * @property {string} [ipAddress]
 */

export {};
