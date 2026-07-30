/**
 * AlertMind — Alert Domain Model
 * Wraps Prisma alert record with domain methods.
 * Used when business logic beyond simple CRUD is needed on an Alert.
 */

import { ALERT_STATUS, SEVERITY_WEIGHT } from '../../shared/constants/app.constants.js';

export class AlertModel {
  /**
   * @param {import('@prisma/client').Alert & { investigation?: object }} raw
   */
  constructor(raw) {
    Object.assign(this, raw);
  }

  /** Whether this alert is currently being analyzed */
  get isProcessing() {
    return this.status === ALERT_STATUS.PROCESSING;
  }

  /** Whether the AI analysis is complete */
  get isCompleted() {
    return this.status === ALERT_STATUS.COMPLETED;
  }

  /** Whether the investigation failed */
  get isFailed() {
    return this.status === ALERT_STATUS.FAILED;
  }

  /** Whether the alert is archived */
  get isArchived() {
    return this.status === ALERT_STATUS.ARCHIVED;
  }

  /** Numeric severity weight for sorting */
  get severityWeight() {
    return SEVERITY_WEIGHT[this.severity] || 0;
  }

  /** Is this a high-priority alert (CRITICAL or HIGH)? */
  get isHighPriority() {
    return this.severityWeight >= SEVERITY_WEIGHT.HIGH;
  }

  /** How long the investigation took in seconds (null if not complete) */
  get investigationDurationSeconds() {
    const ms = this.investigation?.processingTimeMs;
    return ms ? ms / 1000 : null;
  }

  /** Returns a safe summary object (no raw input included) */
  toSummary() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      inputFormat: this.inputFormat,
      source: this.source,
      severity: this.severity,
      status: this.status,
      isHighPriority: this.isHighPriority,
      investigationId: this.investigation?.id || null,
      investigationStatus: this.investigation?.status || null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
