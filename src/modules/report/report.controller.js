/**
 * AlertMind — Report Controller
 */

import { getReport, renderReportHtml, generateReportPdf, getReportMarkdown, getReportPdfBuffer } from './report.service.js';
import { ok } from '../../shared/http/response.js';
import { AUDIT_ACTION } from '../../shared/constants/security.constants.js';
import { createAuditLog } from '../audit/audit.service.js';

export async function getReportHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const report = await getReport(req.params.investigationId, workspaceId);
    return ok(res, report);
  } catch (err) {
    next(err);
  }
}

export async function getReportHtmlHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const html = await renderReportHtml(req.params.investigationId, workspaceId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
}

export async function getReportMarkdownHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const markdown = await getReportMarkdown(req.params.investigationId, workspaceId);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="incident-report-${req.params.investigationId}.md"`);
    res.send(markdown);
  } catch (err) {
    next(err);
  }
}

export async function generatePdfHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.body.workspaceId || req.headers['x-workspace-id'];
    const { investigationId } = req.params;

    const result = await generateReportPdf(investigationId, workspaceId);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.REPORT_EXPORT,
      resource: 'report',
      resourceId: investigationId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { format: 'pdf', storageKey: result.storageKey },
    });

    return ok(res, {
      storageKey: result.storageKey,
      downloadUrl: result.presignedUrl,
      expiresIn: 3600,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/:investigationId/pdf/download
 * Streams the PDF directly — used in local storage mode where the
 * "download URL" is this authenticated API path rather than a presigned link.
 * In MinIO mode this route is unused; the client downloads from the presigned
 * URL returned by generatePdfHandler instead.
 */
export async function downloadPdfHandler(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
    const buffer = await getReportPdfBuffer(req.params.investigationId, workspaceId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="incident-report-${req.params.investigationId}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
