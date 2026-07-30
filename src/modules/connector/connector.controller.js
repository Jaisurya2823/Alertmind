/**
 * AlertMind — Connector Controller
 */

import {
  createConnector,
  listConnectors,
  getConnector,
  updateConnector,
  deleteConnector,
  testConnectorConnection,
  triggerManualSync,
} from './connector.service.js';
import { ok, created, noContent, accepted } from '../../shared/http/response.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AUDIT_ACTION } from '../../shared/constants/security.constants.js';

export async function createConnectorHandler(req, res, next) {
  try {
    const connector = await createConnector(req.body);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.CONNECTOR_CREATE,
      resource: 'connector',
      resourceId: connector.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { type: connector.type, name: connector.name },
    });

    return created(res, connector);
  } catch (err) {
    next(err);
  }
}

export async function listConnectorsHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const connectors = await listConnectors(workspaceId);
    return ok(res, connectors);
  } catch (err) {
    next(err);
  }
}

export async function getConnectorHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const connector = await getConnector(req.params.id, workspaceId);
    return ok(res, connector);
  } catch (err) {
    next(err);
  }
}

export async function updateConnectorHandler(req, res, next) {
  try {
    const workspaceId = req.body.workspaceId || req.headers['x-workspace-id'];
    const connector = await updateConnector(req.params.id, workspaceId, req.body);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.CONNECTOR_UPDATE,
      resource: 'connector',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return ok(res, connector);
  } catch (err) {
    next(err);
  }
}

export async function deleteConnectorHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    await deleteConnector(req.params.id, workspaceId);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.CONNECTOR_DELETE,
      resource: 'connector',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function testConnectionHandler(req, res, next) {
  try {
    const { type, config } = req.body;
    const result = await testConnectorConnection(type, config);
    return ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function triggerSyncHandler(req, res, next) {
  try {
    const workspaceId = req.body.workspaceId || req.headers['x-workspace-id'];
    const result = await triggerManualSync(req.params.id, workspaceId);
    return accepted(res, { jobId: result.jobId, message: 'Sync started' });
  } catch (err) {
    next(err);
  }
}
