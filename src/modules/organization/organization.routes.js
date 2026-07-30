/**
 * AlertMind — Organization Routes
 */

import { Router } from 'express';
import { requireAuth } from '../user/auth.middleware.js';
import { requireAdmin, requirePermission } from '../user/permission.middleware.js';
import { PERMISSION } from '../../shared/constants/security.constants.js';
import { ok, paginated } from '../../shared/http/response.js';
import {
  getOrganization,
  updateOrganizationSettings,
  getOrganizationMembers,
} from './organization.service.js';

const router = Router();

router.use(requireAuth);

// Get current user's organization
router.get('/:id', async (req, res, next) => {
  try {
    const org = await getOrganization(req.params.id, req.user.id);
    return ok(res, org);
  } catch (err) { next(err); }
});

// Update organization settings
router.patch('/:id/settings', requireAdmin, async (req, res, next) => {
  try {
    const settings = await updateOrganizationSettings(req.params.id, req.body, req.user.id);
    return ok(res, settings);
  } catch (err) { next(err); }
});

// List organization members
router.get('/:id/members', requirePermission(PERMISSION.USER_MANAGE), async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const { members, total } = await getOrganizationMembers(req.params.id, +page, +limit);
    return paginated(res, members, { page: +page, limit: +limit, total });
  } catch (err) { next(err); }
});

export default router;
