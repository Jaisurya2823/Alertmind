/**
 * AlertMind — Connector Routes
 * Live SIEM/EDR integration management (Splunk, Elastic).
 */

import { Router } from 'express';
import { requireAuth } from '../user/auth.middleware.js';
import { requirePermission } from '../user/permission.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { PERMISSION } from '../../shared/constants/security.constants.js';
import {
  createConnectorSchema,
  updateConnectorSchema,
  connectorIdParamSchema,
  testConnectionSchema,
} from './connector.schema.js';
import {
  createConnectorHandler,
  listConnectorsHandler,
  getConnectorHandler,
  updateConnectorHandler,
  deleteConnectorHandler,
  testConnectionHandler,
  triggerSyncHandler,
} from './connector.controller.js';

const router = Router();

router.use(requireAuth);

// Test a connection before saving — no persistence, just validates reachability
router.post(
  '/test',
  requirePermission(PERMISSION.CONNECTOR_WRITE),
  validate({ body: testConnectionSchema }),
  testConnectionHandler
);

router.post(
  '/',
  requirePermission(PERMISSION.CONNECTOR_WRITE),
  validate({ body: createConnectorSchema }),
  createConnectorHandler
);

router.get(
  '/',
  requirePermission(PERMISSION.CONNECTOR_READ),
  listConnectorsHandler
);

router.get(
  '/:id',
  requirePermission(PERMISSION.CONNECTOR_READ),
  validate({ params: connectorIdParamSchema }),
  getConnectorHandler
);

router.patch(
  '/:id',
  requirePermission(PERMISSION.CONNECTOR_WRITE),
  validate({ params: connectorIdParamSchema, body: updateConnectorSchema }),
  updateConnectorHandler
);

router.delete(
  '/:id',
  requirePermission(PERMISSION.CONNECTOR_WRITE),
  validate({ params: connectorIdParamSchema }),
  deleteConnectorHandler
);

router.post(
  '/:id/sync',
  requirePermission(PERMISSION.CONNECTOR_WRITE),
  validate({ params: connectorIdParamSchema }),
  triggerSyncHandler
);

export default router;
