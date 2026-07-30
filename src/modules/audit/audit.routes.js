/**
 * AlertMind — Audit Routes
 * Read-only — audit logs are append-only and cannot be modified.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../user/auth.middleware.js';
import { requirePermission } from '../user/permission.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { paginated } from '../../shared/http/response.js';
import { listAuditLogs } from './audit.service.js';
import { PERMISSION } from '../../shared/constants/security.constants.js';

const router = Router();

const listAuditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  resource: z.string().max(100).optional(),
  resourceId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.use(requireAuth);

router.get('/', requirePermission(PERMISSION.AUDIT_READ), validate({ query: listAuditQuerySchema }), async (req, res, next) => {
  try {
    const { logs, total } = await listAuditLogs(req.query);
    return paginated(res, logs, { page: req.query.page, limit: req.query.limit, total });
  } catch (err) { next(err); }
});

export default router;
