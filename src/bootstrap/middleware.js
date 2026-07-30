/**
 * AlertMind — Middleware Bootstrap
 * Applies global middleware that doesn't fit in app.js directly.
 * Called during Express app initialization.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Applies application-level middleware to the Express instance.
 * @param {import('express').Application} app
 */
export function applyMiddleware(app) {
  // ─── Request ID ────────────────────────────────────────────────────────────
  // Assign unique ID to every request for tracing and error correlation
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // ─── Real IP Resolution ───────────────────────────────────────────────────
  // Behind Nginx/K8s ingress, X-Forwarded-For contains the real client IP
  // app.set('trust proxy', 1) is already set in app.js; req.ip resolves correctly
  app.use((req, _res, next) => {
    // Normalize IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 → 192.168.1.1)
    if (req.ip && req.ip.startsWith('::ffff:')) {
      req.realIp = req.ip.slice(7);
    } else {
      req.realIp = req.ip;
    }
    next();
  });
}
