/**
 * AlertMind — Event Factory Functions
 * Creates typed event payloads for the event bus.
 */

import { EVENTS } from './eventBus.js';
import { eventBus } from './eventBus.js';

/**
 * Emits investigation completed event.
 * @param {string} investigationId
 * @param {string} alertId
 * @param {string} severity
 */
export function emitInvestigationCompleted(investigationId, alertId, severity) {
  eventBus.safeEmit(EVENTS.INVESTIGATION_COMPLETED, {
    investigationId,
    alertId,
    severity,
    completedAt: new Date().toISOString(),
  });
}

/**
 * Emits investigation failed event.
 * @param {string} investigationId
 * @param {string} errorMessage
 */
export function emitInvestigationFailed(investigationId, errorMessage) {
  eventBus.safeEmit(EVENTS.INVESTIGATION_FAILED, {
    investigationId,
    errorMessage,
    failedAt: new Date().toISOString(),
  });
}

/**
 * Emits alert submitted event.
 * @param {string} alertId
 * @param {string} workspaceId
 * @param {string} format
 */
export function emitAlertSubmitted(alertId, workspaceId, format) {
  eventBus.safeEmit(EVENTS.ALERT_SUBMITTED, { alertId, workspaceId, format });
}

/**
 * Emits report generated event.
 * @param {string} investigationId
 * @param {string} reportId
 */
export function emitReportGenerated(investigationId, reportId) {
  eventBus.safeEmit(EVENTS.REPORT_GENERATED, { investigationId, reportId });
}

export { EVENTS, eventBus };
