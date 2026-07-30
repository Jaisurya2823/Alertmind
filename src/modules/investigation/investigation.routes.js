/**
 * AlertMind — Investigation Routes
 */

import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { requireAuth } from '../user/auth.middleware.js';
import { requirePermission } from '../user/permission.middleware.js';
import { PERMISSION } from '../../shared/constants/security.constants.js';
import {
  investigationIdParamSchema,
  listInvestigationsQuerySchema,
} from './investigation.schema.js';
import {
  getInvestigationHandler,
  getInvestigationStatusHandler,
  listInvestigationsHandler,
  retryInvestigationHandler,
} from './investigation.controller.js';

const router = Router();

router.use(requireAuth);

// List all investigations for a workspace
router.get(
  '/',
  requirePermission(PERMISSION.INVESTIGATION_READ),
  validate({ query: listInvestigationsQuerySchema }),
  listInvestigationsHandler
);

// Get full investigation results (complete nested payload)
router.get(
  '/:id',
  requirePermission(PERMISSION.INVESTIGATION_READ),
  validate({ params: investigationIdParamSchema }),
  getInvestigationHandler
);

// Lightweight status polling (for frontend progress UI)
router.get(
  '/:id/status',
  requirePermission(PERMISSION.INVESTIGATION_READ),
  validate({ params: investigationIdParamSchema }),
  getInvestigationStatusHandler
);

// Retry failed investigation
router.post(
  '/:id/retry',
  requirePermission(PERMISSION.INVESTIGATION_WRITE),
  validate({ params: investigationIdParamSchema }),
  retryInvestigationHandler
);

export default router;
