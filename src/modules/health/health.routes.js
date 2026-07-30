/**
 * AlertMind — Health Routes
 * No authentication — must be reachable by load balancers and k8s probes
 */

import { Router } from 'express';
import { livenessHandler, readinessHandler } from './health.controller.js';

const router = Router();

// Kubernetes liveness probe — is the process alive?
router.get('/live', livenessHandler);

// Kubernetes readiness probe / full health check — are all deps healthy?
router.get('/', readinessHandler);
router.get('/ready', readinessHandler);

export default router;
