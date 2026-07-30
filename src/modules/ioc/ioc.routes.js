/**
 * AlertMind — Module Routes (stub — full implementation in next iteration)
 */
import { Router } from 'express';
import { requireAuth } from '../user/auth.middleware.js';
import { ok } from '../../shared/http/response.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => ok(res, { data: [], message: 'Module active' }));

export default router;
