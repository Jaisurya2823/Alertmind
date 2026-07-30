/**
 * AlertMind — Security Constants
 * Cryptographic parameters, session policies, input limits
 */

// ─── Argon2 Password Hashing ─────────────────────────────────────────────────
// OWASP recommended parameters for Argon2id (2024)
export const ARGON2_OPTIONS = Object.freeze({
  type: 2, // argon2id (hybrid — resists GPU and side-channel)
  memoryCost: 65536, // 64 MiB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
  hashLength: 32, // 32 bytes output
  saltLength: 16, // 16 bytes salt
});

// ─── JWT (RS256 — asymmetric, supports JWKS rotation) ───────────────────────
export const JWT_ALGORITHM = 'RS256';
export const JWT_ACCESS_TOKEN_EXPIRY = '15m';
export const JWT_REFRESH_TOKEN_EXPIRY = '7d';
export const JWT_ISSUER = 'alertmind';
export const JWT_AUDIENCE = 'alertmind-api';

// ─── API Keys ────────────────────────────────────────────────────────────────
export const API_KEY_BYTES = 32; // 256-bit random key
export const API_KEY_PREFIX = 'am_';
export const API_KEY_PREFIX_LENGTH = 12; // prefix stored plaintext for lookup

// ─── Encryption (AES-256-GCM for connector credentials) ────────────────────
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const ENCRYPTION_IV_BYTES = 12; // 96-bit IV (GCM standard)
export const ENCRYPTION_AUTH_TAG_BYTES = 16; // 128-bit auth tag

// ─── Session ────────────────────────────────────────────────────────────────
export const SESSION_COOKIE_NAME = '__Host-am-session';
export const SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
});

// ─── Input Limits ────────────────────────────────────────────────────────────
export const MAX_EMAIL_LENGTH = 254; // RFC 5321
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_NAME_LENGTH = 255;
export const MAX_TEXT_FIELD_LENGTH = 10_000;
export const MAX_ALERT_RAW_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Password Policy ────────────────────────────────────────────────────────
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,128}$/;

// ─── Rate Limit Keys ────────────────────────────────────────────────────────
export const RATE_LIMIT_PREFIX = Object.freeze({
  GLOBAL: 'rl:global:',
  AI: 'rl:ai:',
  AUTH: 'rl:auth:',
  EXPORT: 'rl:export:',
});

// ─── Audit Actions ───────────────────────────────────────────────────────────
export const AUDIT_ACTION = Object.freeze({
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password_change',
  API_KEY_CREATE: 'api_key.create',
  API_KEY_REVOKE: 'api_key.revoke',
  ALERT_SUBMIT: 'alert.submit',
  ALERT_DELETE: 'alert.delete',
  INVESTIGATION_START: 'investigation.start',
  INVESTIGATION_COMPLETE: 'investigation.complete',
  REPORT_EXPORT: 'report.export',
  CONNECTOR_CREATE: 'connector.create',
  CONNECTOR_UPDATE: 'connector.update',
  CONNECTOR_DELETE: 'connector.delete',
  SETTINGS_UPDATE: 'settings.update',
  USER_INVITE: 'user.invite',
  USER_REMOVE: 'user.remove',
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_DELETE: 'workspace.delete',
});

// ─── Permissions ────────────────────────────────────────────────────────────
export const PERMISSION = Object.freeze({
  ALERT_READ: 'alert:read',
  ALERT_WRITE: 'alert:write',
  ALERT_DELETE: 'alert:delete',
  INVESTIGATION_READ: 'investigation:read',
  INVESTIGATION_WRITE: 'investigation:write',
  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',
  CONNECTOR_READ: 'connector:read',
  CONNECTOR_WRITE: 'connector:write',
  USER_MANAGE: 'user:manage',
  SETTINGS_MANAGE: 'settings:manage',
  BILLING_MANAGE: 'billing:manage',
  AUDIT_READ: 'audit:read',
});

// Role → Permissions mapping
export const ROLE_PERMISSIONS = Object.freeze({
  OWNER: Object.values(PERMISSION),
  ADMIN: [
    PERMISSION.ALERT_READ,
    PERMISSION.ALERT_WRITE,
    PERMISSION.ALERT_DELETE,
    PERMISSION.INVESTIGATION_READ,
    PERMISSION.INVESTIGATION_WRITE,
    PERMISSION.REPORT_READ,
    PERMISSION.REPORT_EXPORT,
    PERMISSION.CONNECTOR_READ,
    PERMISSION.CONNECTOR_WRITE,
    PERMISSION.USER_MANAGE,
    PERMISSION.SETTINGS_MANAGE,
    PERMISSION.AUDIT_READ,
  ],
  ANALYST: [
    PERMISSION.ALERT_READ,
    PERMISSION.ALERT_WRITE,
    PERMISSION.INVESTIGATION_READ,
    PERMISSION.INVESTIGATION_WRITE,
    PERMISSION.REPORT_READ,
    PERMISSION.REPORT_EXPORT,
    PERMISSION.CONNECTOR_READ,
  ],
  VIEWER: [
    PERMISSION.ALERT_READ,
    PERMISSION.INVESTIGATION_READ,
    PERMISSION.REPORT_READ,
  ],
});
