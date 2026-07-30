/**
 * AlertMind — Report Routes
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../config/redis.config.js';
import { requireAuth } from '../user/auth.middleware.js';
import { requirePermission } from '../user/permission.middleware.js';
import { PERMISSION, RATE_LIMIT_PREFIX } from '../../shared/constants/security.constants.js';
import {
  getReportHandler,
  getReportHtmlHandler,
  getReportMarkdownHandler,
  generatePdfHandler,
  downloadPdfHandler,
} from './report.controller.js';

const router = Router();

// PDF generation is expensive — strict rate limit
const pdfRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: RATE_LIMIT_PREFIX.EXPORT,
  }),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'PDF generation rate limit exceeded. Maximum 5 PDFs per minute.',
      code: 'PDF_RATE_LIMIT_EXCEEDED',
    });
  },
});

router.use(requireAuth);

// Get report JSON (full data)
router.get('/:investigationId', requirePermission(PERMISSION.REPORT_READ), getReportHandler);

// Get rendered HTML version
router.get('/:investigationId/html', requirePermission(PERMISSION.REPORT_READ), getReportHtmlHandler);

// Download Markdown
router.get('/:investigationId/markdown', requirePermission(PERMISSION.REPORT_EXPORT), getReportMarkdownHandler);

// Generate and download PDF
router.post('/:investigationId/pdf', requirePermission(PERMISSION.REPORT_EXPORT), pdfRateLimiter, generatePdfHandler);

// Streams the PDF directly — used when STORAGE_PROVIDER=local (default).
// In MinIO mode, the presigned URL from the POST above is used instead.
router.get('/:investigationId/pdf/download', requirePermission(PERMISSION.REPORT_EXPORT), downloadPdfHandler);

export default router;
