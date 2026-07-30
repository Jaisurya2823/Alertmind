/**
 * AlertMind — Cache Key Builders
 * All Redis keys defined here — single source of truth.
 * Prevents typos, makes invalidation easy to find, avoids namespace collisions.
 */

export const CacheKeys = Object.freeze({
  // ─── Investigation ──────────────────────────────────────────────────────
  investigation: (id) => `investigation:${id}`,
  investigationList: (workspaceId, page, limit) =>
    `investigation:list:${workspaceId}:${page}:${limit}`,

  // ─── Alert ──────────────────────────────────────────────────────────────
  alert: (id) => `alert:${id}`,
  alertList: (workspaceId, page, limit) =>
    `alert:list:${workspaceId}:${page}:${limit}`,

  // ─── Report ─────────────────────────────────────────────────────────────
  report: (investigationId) => `report:${investigationId}`,

  // ─── MITRE (long TTL — MITRE data changes infrequently) ─────────────────
  mitreAll: () => 'mitre:all',
  mitreTechnique: (id) => `mitre:technique:${id}`,
  mitreSearch: (query) => `mitre:search:${Buffer.from(query).toString('base64')}`,

  // ─── User ────────────────────────────────────────────────────────────────
  user: (id) => `user:${id}`,
  userByEmail: (email) => `user:email:${email}`,
  userPermissions: (userId) => `user:permissions:${userId}`,

  // ─── Organization ────────────────────────────────────────────────────────
  organization: (id) => `org:${id}`,
  organizationSettings: (orgId) => `org:settings:${orgId}`,

  // ─── Workspace ───────────────────────────────────────────────────────────
  workspace: (id) => `workspace:${id}`,
  workspaceList: (orgId) => `workspace:list:${orgId}`,

  // ─── Analytics ───────────────────────────────────────────────────────────
  analyticsOverview: (orgId) => `analytics:overview:${orgId}`,
  analyticsTrends: (orgId, period) => `analytics:trends:${orgId}:${period}`,

  // ─── Connector ──────────────────────────────────────────────────────────
  connectorList: (workspaceId) => `connector:list:${workspaceId}`,
  connectorSyncDedup: (connectorId, externalId) => `connector:dedup:${connectorId}:${externalId}`,

  // ─── API Key ────────────────────────────────────────────────────────────
  apiKey: (keyHash) => `apikey:${keyHash}`,
});

/**
 * Cache TTL constants in seconds.
 * Named for clarity — do not use raw numbers in cacheSet() calls.
 */
export const CacheTTL = Object.freeze({
  SHORT: 60,           // 1 minute — volatile data
  MEDIUM: 300,         // 5 minutes — user/org data
  LONG: 3600,          // 1 hour — investigation results
  VERY_LONG: 86400,    // 24 hours — MITRE data, static lookups
  WEEK: 604800,        // 7 days — rarely changing data
});

/**
 * Pattern builders for bulk invalidation.
 * Used with cacheInvalidatePattern().
 */
export const CachePatterns = Object.freeze({
  allForInvestigation: (id) => `*:${id}*`,
  allForWorkspace: (workspaceId) => `*:${workspaceId}*`,
  allAlerts: () => 'alert:*',
  allInvestigations: () => 'investigation:*',
  allMitre: () => 'mitre:*',
});
