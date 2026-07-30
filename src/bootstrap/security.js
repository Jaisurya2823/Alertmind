/**
 * AlertMind — Security Bootstrap
 * Applies security-specific middleware and headers.
 * Called in app.js during initialization.
 */

import { getConfig } from '../config/env.js';

const config = getConfig();

/**
 * Applies security middleware and headers to the Express instance.
 * Helmet is configured in app.js; this handles additional security hardening.
 * @param {import('express').Application} app
 */
export function applySecurity(app) {
  // ─── Disable server fingerprinting ──────────────────────────────────────
  app.disable('x-powered-by');

  // ─── Production-only security ────────────────────────────────────────────
  if (config.NODE_ENV === 'production') {
    // Force HTTPS redirect in production
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.hostname}${req.url}`);
      }
      next();
    });
  }

  // ─── Prevent clickjacking via Content-Security-Policy ───────────────────
  // frame-ancestors is set in Helmet CSP config in app.js
  // This adds an additional X-Frame-Options header for older browsers
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
}
