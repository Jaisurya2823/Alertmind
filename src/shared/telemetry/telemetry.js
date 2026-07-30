/**
 * AlertMind — Telemetry Bootstrap
 * OpenTelemetry SDK + Sentry must be initialized BEFORE all other imports.
 * Called as the very first line in server.js
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Initializes Sentry error tracking and performance monitoring.
 * Safe to call even without SENTRY_DSN — Sentry is a no-op without it.
 */
export function initializeTelemetry() {
  const dsn = process.env.SENTRY_DSN;
  const env = process.env.NODE_ENV || 'production';
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2');
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1');

  Sentry.init({
    dsn,
    environment: env,
    release: `alertmind@${process.env.npm_package_version || '1.0.0'}`,
    enabled: !!dsn && env !== 'test',
    tracesSampleRate,
    profilesSampleRate,
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.prismaIntegration(),
    ],
    // PII scrubbing — do NOT send sensitive fields to Sentry
    beforeSend(event) {
      if (event.request) {
        // Strip authorization headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['x-api-key'];
          delete event.request.headers['cookie'];
        }
        // Strip request body (may contain alert data)
        delete event.request.data;
      }
      return event;
    },
    // Filter out noisy/expected errors from Sentry
    ignoreErrors: [
      'Not Found',
      'Unauthorized',
      'Forbidden',
      'Too Many Requests',
    ],
  });
}

/**
 * Captures an exception in Sentry with optional context.
 * @param {Error} error
 * @param {Record<string, unknown>} [context]
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, { extra: context });
}

/**
 * Sets user context for the current Sentry scope.
 * Call after authentication middleware resolves the user.
 * @param {{ id: string, email: string, role: string }} user
 */
export function setSentryUser(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Do NOT include username or other PII beyond email
  });
}

/**
 * Adds structured breadcrumb to the current Sentry scope.
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 * @param {'info'|'warning'|'error'|'debug'} [level]
 */
export function addBreadcrumb(message, data = {}, level = 'info') {
  Sentry.addBreadcrumb({
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

export { Sentry };
