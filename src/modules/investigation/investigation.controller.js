/**
 * AlertMind — Investigation Controller
 */

import {
  getInvestigation,
  getInvestigationStatus,
  listInvestigations,
  retryInvestigation,
} from './investigation.service.js';
import { ok, paginated } from '../../shared/http/response.js';

/**
 * GET /api/v1/investigations/:id
 * Returns full investigation with all nested results
 */
export async function getInvestigationHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const investigation = await getInvestigation(req.params.id, workspaceId);
    return ok(res, investigation);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investigations/:id/status
 * Lightweight status polling — returns status + severity only
 */
export async function getInvestigationStatusHandler(req, res, next) {
  try {
    const status = await getInvestigationStatus(req.params.id);
    return ok(res, status);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investigations
 * Lists investigations for a workspace with pagination
 */
export async function listInvestigationsHandler(req, res, next) {
  try {
    const { investigations, total } = await listInvestigations(req.query);
    return paginated(res, investigations, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/investigations/:id/retry
 * Re-enqueues a failed investigation
 */
export async function retryInvestigationHandler(req, res, next) {
  try {
    const workspaceId = req.body.workspaceId || req.headers['x-workspace-id'];
    const result = await retryInvestigation(req.params.id, workspaceId);
    return ok(res, result);
  } catch (err) {
    next(err);
  }
}
