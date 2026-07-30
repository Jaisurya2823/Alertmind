/**
 * AlertMind — Application Constants
 */

export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
});

export const ALERT_FORMAT = Object.freeze({
  JSON: 'JSON',
  SYSLOG: 'SYSLOG',
  WINDOWS_EVENT: 'WINDOWS_EVENT',
  SYSMON: 'SYSMON',
  SIGMA: 'SIGMA',
  WAZUH: 'WAZUH',
  SPLUNK: 'SPLUNK',
  ELASTIC: 'ELASTIC',
  DEFENDER: 'DEFENDER',
  CROWDSTRIKE: 'CROWDSTRIKE',
  SENTINELONE: 'SENTINELONE',
  PLAIN_TEXT: 'PLAIN_TEXT',
  CSV: 'CSV',
});

export const ALERT_SOURCE = Object.freeze({
  MICROSOFT_DEFENDER: 'MICROSOFT_DEFENDER',
  CROWDSTRIKE: 'CROWDSTRIKE',
  SENTINEL: 'SENTINEL',
  SPLUNK: 'SPLUNK',
  ELASTIC: 'ELASTIC',
  WAZUH: 'WAZUH',
  AWS_GUARDDUTY: 'AWS_GUARDDUTY',
  GCP_SCC: 'GCP_SCC',
  SENTINELONE: 'SENTINELONE',
  SURICATA: 'SURICATA',
  ZEEK: 'ZEEK',
  SYSMON: 'SYSMON',
  MANUAL: 'MANUAL',
});

export const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFORMATIONAL: 'INFORMATIONAL',
});

export const SEVERITY_WEIGHT = Object.freeze({
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFORMATIONAL: 1,
});

export const ALERT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
});

export const INVESTIGATION_STATUS = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
});

export const ENTITY_TYPE = Object.freeze({
  IP_ADDRESS: 'IP_ADDRESS',
  DOMAIN: 'DOMAIN',
  URL: 'URL',
  FILE_HASH: 'FILE_HASH',
  FILE_PATH: 'FILE_PATH',
  USERNAME: 'USERNAME',
  HOSTNAME: 'HOSTNAME',
  PROCESS: 'PROCESS',
  COMMAND: 'COMMAND',
  REGISTRY_KEY: 'REGISTRY_KEY',
  EMAIL: 'EMAIL',
  CERTIFICATE: 'CERTIFICATE',
  PORT: 'PORT',
  PROTOCOL: 'PROTOCOL',
  CVE: 'CVE',
  PACKAGE: 'PACKAGE',
});

export const IOC_TYPE = Object.freeze({
  IP_ADDRESS: 'IP_ADDRESS',
  DOMAIN: 'DOMAIN',
  URL: 'URL',
  MD5: 'MD5',
  SHA1: 'SHA1',
  SHA256: 'SHA256',
  EMAIL: 'EMAIL',
  FILENAME: 'FILENAME',
  REGISTRY_KEY: 'REGISTRY_KEY',
  CERTIFICATE_HASH: 'CERTIFICATE_HASH',
  ASN: 'ASN',
  USER_AGENT: 'USER_AGENT',
});

export const TLP = Object.freeze({
  RED: 'RED',
  AMBER: 'AMBER',
  GREEN: 'GREEN',
  WHITE: 'WHITE',
});

export const PRIORITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const ROLE = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
});

export const WORKSPACE_ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
});

export const PLAN = Object.freeze({
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
});

export const CONNECTOR_TYPE = Object.freeze({
  SPLUNK: 'SPLUNK',
  SENTINEL: 'SENTINEL',
  DEFENDER: 'DEFENDER',
  CROWDSTRIKE: 'CROWDSTRIKE',
  ELASTIC: 'ELASTIC',
  AWS: 'AWS',
  AZURE: 'AZURE',
  GCP: 'GCP',
  OKTA: 'OKTA',
  JIRA: 'JIRA',
  SERVICENOW: 'SERVICENOW',
  SLACK: 'SLACK',
  TEAMS: 'TEAMS',
  PAGERDUTY: 'PAGERDUTY',
});

// Supported MIME types for alert file uploads
export const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze([
  'application/json',
  'text/plain',
  'text/csv',
  'application/xml',
  'text/xml',
  'text/x-log',
  'application/octet-stream', // some log files
]);

export const ALLOWED_UPLOAD_EXTENSIONS = Object.freeze([
  '.json',
  '.txt',
  '.log',
  '.csv',
  '.xml',
  '.evtx',
]);

export const PAGINATION_DEFAULT_LIMIT = 25;
export const PAGINATION_MAX_LIMIT = 100;

export const API_KEY_PREFIX = 'am_';
export const API_KEY_PREFIX_LENGTH = 8;
