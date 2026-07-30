/**
 * AlertMind — Alert Zod Schemas (Canonical)
 * Re-exports from module schema. src/schemas/ is the canonical location.
 * Module-level schemas import FROM here — not the other way.
 */

export {
  submitAlertBodySchema,
  uploadAlertBodySchema,
  listAlertsQuerySchema,
  alertIdParamSchema,
} from '../modules/alert/alert.schema.js';
