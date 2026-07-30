/**
 * AlertMind — Event Bus
 * In-process EventEmitter for decoupled module communication.
 * Used for: investigation completed events, notification triggers, audit hooks.
 */

import { EventEmitter } from 'node:events';
import logger from '../logger/logger.js';

class AlertMindEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);

    // Log unhandled event errors
    this.on('error', (err) => {
      logger.error({ err }, 'EventBus unhandled error');
    });
  }

  /**
   * Emits an event with error isolation — listener errors don't crash the emitter.
   * @param {string} event
   * @param {...unknown} args
   */
  safeEmit(event, ...args) {
    try {
      this.emit(event, ...args);
    } catch (err) {
      logger.error({ err, event }, 'EventBus listener threw an error');
    }
  }
}

export const eventBus = new AlertMindEventBus();

// ─── Event name constants ────────────────────────────────────────────────────
export const EVENTS = Object.freeze({
  INVESTIGATION_COMPLETED: 'investigation:completed',
  INVESTIGATION_FAILED: 'investigation:failed',
  ALERT_SUBMITTED: 'alert:submitted',
  REPORT_GENERATED: 'report:generated',
  USER_REGISTERED: 'user:registered',
  USER_LOGGED_IN: 'user:logged_in',
  CONNECTOR_SYNCED: 'connector:synced',
  BILLING_LIMIT_REACHED: 'billing:limit_reached',
});
