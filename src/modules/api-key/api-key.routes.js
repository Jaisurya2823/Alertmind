/**
 * AlertMind — API Key Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../user/auth.middleware.js';
import { requireAdmin } from '../user/permission.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { ok, created, noContent } from '../../shared/http/response.js';
import { createApiKey, listApiKeys, revokeApiKey } from './api-key.service.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AUDIT_ACTION } from '../../shared/constants/security.constants.js';

const router = Router();

const createKeySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  permissions: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

router.use(requireAuth);

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.query.organizationId || req.user.organizationId;
    const keys = await listApiKeys(orgId, req.user.id);
    return ok(res, keys);
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, validate({ body: createKeySchema }), async (req, res, next) => {
  try {
    const key = await createApiKey({ ...req.body, userId: req.user.id });

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.API_KEY_CREATE,
      resource: 'api_key',
      resourceId: key.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { name: key.name, keyPrefix: key.keyPrefix },
    });

    return created(res, key);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.body.organizationId || req.user.organizationId;
    await revokeApiKey(req.params.id, orgId, req.user.id);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.API_KEY_REVOKE,
      resource: 'api_key',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return noContent(res);
  } catch (err) { next(err); }
});

export default router;
