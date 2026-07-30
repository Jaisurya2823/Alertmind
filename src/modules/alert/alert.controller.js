/**
 * AlertMind — Alert Controller
 */

import {
  submitAlert,
  submitAlertFromFile,
  getAlert,
  listAlerts,
  archiveAlert,
} from './alert.service.js';
import {
  ok,
  accepted,
  paginated,
  noContent,
} from '../../shared/http/response.js';
import { BadRequestError } from '../../shared/errors/app.error.js';
import { AUDIT_ACTION } from '../../shared/constants/security.constants.js';
import { createAuditLog } from '../audit/audit.service.js';

/**
 * POST /api/v1/alerts
 * Submit a new alert for AI investigation (text/JSON paste)
 */
export async function submitAlertHandler(req, res, next) {
  try {
    const { rawInput, inputFormat, source, workspaceId } = req.body;
    const result = await submitAlert({
      rawInput,
      inputFormat,
      source,
      workspaceId,
      submittedBy: req.user.id,
      ipAddress: req.ip,
    });

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.ALERT_SUBMIT,
      resource: 'alert',
      resourceId: result.alertId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { workspaceId, format: inputFormat },
    });

    return accepted(res, {
      alertId: result.alertId,
      investigationId: result.investigationId,
      jobId: result.jobId,
      message: 'Alert submitted. Investigation is processing.',
      estimatedSeconds: 60,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/alerts/upload
 * Submit a new alert via file upload
 */
export async function uploadAlertHandler(req, res, next) {
  try {
    if (!req.file) {
      throw new BadRequestError('No file uploaded. Include a file in the "alert" field.');
    }

    const { workspaceId, inputFormat, source } = req.body;
    const result = await submitAlertFromFile({
      file: req.file,
      inputFormat,
      source,
      workspaceId,
      submittedBy: req.user.id,
      ipAddress: req.ip,
    });

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.ALERT_SUBMIT,
      resource: 'alert',
      resourceId: result.alertId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        workspaceId,
        filename: req.file.originalname,
        size: req.file.size,
      },
    });

    return accepted(res, {
      alertId: result.alertId,
      investigationId: result.investigationId,
      jobId: result.jobId,
      message: 'Alert file uploaded. Investigation is processing.',
      estimatedSeconds: 60,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/alerts/:id
 * Get a single alert with investigation status
 */
export async function getAlertHandler(req, res, next) {
  try {
    const { id } = req.params;
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const alert = await getAlert(id, workspaceId);
    return ok(res, alert);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/alerts
 * List alerts for a workspace with pagination
 */
export async function listAlertsHandler(req, res, next) {
  try {
    const { alerts, total } = await listAlerts(req.query);
    return paginated(res, alerts, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/alerts/:id
 * Archive (soft-delete) an alert
 */
export async function archiveAlertHandler(req, res, next) {
  try {
    const { id } = req.params;
    const workspaceId = req.body.workspaceId || req.headers['x-workspace-id'];

    await archiveAlert(id, workspaceId);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.ALERT_DELETE,
      resource: 'alert',
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return noContent(res);
  } catch (err) {
    next(err);
  }
}
