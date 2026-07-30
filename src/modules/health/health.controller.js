/**
 * AlertMind — Health Controller
 */

import { getLivenessStatus, getReadinessStatus } from './health.service.js';
import { HTTP_STATUS } from '../../shared/constants/app.constants.js';

/**
 * GET /api/health/live — Kubernetes liveness probe
 * Returns 200 immediately (if process is alive, it can respond)
 */
export async function livenessHandler(req, res) {
  const status = getLivenessStatus();
  return res.status(HTTP_STATUS.OK).json(status);
}

/**
 * GET /api/health — Full readiness check
 * Returns 200 if all dependencies are healthy, 503 if unhealthy
 */
export async function readinessHandler(req, res) {
  const status = await getReadinessStatus();

  const httpStatus =
    status.status === 'unhealthy'
      ? HTTP_STATUS.SERVICE_UNAVAILABLE
      : HTTP_STATUS.OK;

  return res.status(httpStatus).json(status);
}
