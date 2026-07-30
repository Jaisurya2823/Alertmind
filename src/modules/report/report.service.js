/**
 * AlertMind — Report Service
 * Handles report retrieval, HTML rendering, PDF generation via Puppeteer,
 * and file storage (local disk by default, MinIO if STORAGE_PROVIDER=minio).
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer-core';
import { getPrismaClient } from '../../bootstrap/startup.js';
import {
  uploadToStorage,
  getPresignedDownloadUrl,
  readFromStorage,
  getActiveStorageProviderName,
} from '../../config/storage.config.js';
import { findChromiumExecutable } from '../../shared/pdf/chromiumLocator.js';
import { cacheGet, cacheSet } from '../../shared/cache/cache.js';
import { CacheKeys, CacheTTL } from '../../shared/cache/cacheKeys.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/app.error.js';
import logger from '../../shared/logger/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const md = new MarkdownIt({
  html: false,     // Disable raw HTML in markdown — security
  linkify: true,
  typographer: true,
});

/**
 * Gets a report by investigation ID.
 * @param {string} investigationId
 * @param {string} workspaceId
 */
export async function getReport(investigationId, workspaceId) {
  const cached = await cacheGet(CacheKeys.report(investigationId));
  if (cached) return cached;

  const prisma = getPrismaClient();

  const report = await prisma.report.findUnique({
    where: { investigationId },
    include: {
      investigation: {
        select: {
          id: true, status: true, threatCategory: true,
          alert: { select: { workspaceId: true, inputFormat: true, source: true } },
        },
      },
    },
  });

  if (!report) throw new NotFoundError('Report', investigationId);
  if (report.investigation.alert.workspaceId !== workspaceId) throw new ForbiddenError();

  await cacheSet(CacheKeys.report(investigationId), report, CacheTTL.LONG);
  return report;
}

/**
 * Renders report markdown to HTML using MarkdownIt.
 * Returns standalone HTML with embedded CSS for export.
 * @param {string} investigationId
 * @param {string} workspaceId
 * @returns {Promise<string>} HTML string
 */
export async function renderReportHtml(investigationId, workspaceId) {
  const report = await getReport(investigationId, workspaceId);

  const bodyHtml = md.render(report.markdownContent);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlertMind — Incident Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; background: #fff; padding: 40px; max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 24px; color: #0f3460; border-bottom: 3px solid #e94560; padding-bottom: 12px; margin-bottom: 24px; }
    h2 { font-size: 18px; color: #0f3460; margin: 32px 0 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
    h3 { font-size: 15px; color: #16213e; margin: 20px 0 8px; }
    p { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #0f3460; color: #fff; padding: 10px 12px; text-align: left; font-size: 13px; }
    td { padding: 9px 12px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    tr:nth-child(even) { background: #f8f9fa; }
    code { background: #1a1a2e; color: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 12px; }
    pre { background: #1a1a2e; color: #e2e8f0; padding: 16px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
    pre code { background: none; padding: 0; }
    ul, ol { padding-left: 24px; margin-bottom: 12px; }
    li { margin-bottom: 4px; }
    strong { color: #0f3460; }
    blockquote { border-left: 4px solid #e94560; padding-left: 16px; color: #555; margin: 16px 0; }
    .severity-critical { color: #dc2626; font-weight: bold; }
    .severity-high { color: #ea580c; font-weight: bold; }
    .severity-medium { color: #ca8a04; font-weight: bold; }
    .severity-low { color: #16a34a; font-weight: bold; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  return html;
}

/**
 * Generates a PDF of the report using Puppeteer, pointed at the user's
 * existing Chrome/Edge install (see chromiumLocator.js) — no Docker or
 * bundled Chromium download required.
 *
 * Stores the PDF via the active storage provider (local disk by default)
 * and updates the report record with the storage key.
 *
 * @param {string} investigationId
 * @param {string} workspaceId
 * @returns {Promise<{ storageKey: string, presignedUrl: string }>}
 */
export async function generateReportPdf(investigationId, workspaceId) {
  const report = await getReport(investigationId, workspaceId);

  // If PDF already generated and stored, return a fresh download reference
  if (report.pdfStoragePath) {
    const url = await buildDownloadReference(investigationId, report.pdfStoragePath);
    return { storageKey: report.pdfStoragePath, presignedUrl: url };
  }

  const html = await renderReportHtml(investigationId, workspaceId);

  let browser;
  try {
    const executablePath = findChromiumExecutable();

    browser = await puppeteer.launch({
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });

    const storageKey = `reports/${investigationId}/incident-report.pdf`;

    await uploadToStorage(storageKey, Buffer.from(pdfBuffer), 'application/pdf', {
      'investigation-id': investigationId,
    });

    const prisma = getPrismaClient();
    await prisma.report.update({
      where: { investigationId },
      data: {
        pdfStoragePath: storageKey,
        exportedAt: new Date(),
      },
    });

    const downloadRef = await buildDownloadReference(investigationId, storageKey);
    logger.info({ investigationId, storageKey }, 'PDF report generated and stored');

    return { storageKey, presignedUrl: downloadRef };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Returns the Markdown content of a report.
 */
export async function getReportMarkdown(investigationId, workspaceId) {
  const report = await getReport(investigationId, workspaceId);
  return report.markdownContent;
}

/**
 * Reads a stored PDF back into memory for streaming — used by the
 * authenticated download route when running in local storage mode.
 * @param {string} investigationId
 * @param {string} workspaceId
 * @returns {Promise<Buffer>}
 */
export async function getReportPdfBuffer(investigationId, workspaceId) {
  const report = await getReport(investigationId, workspaceId);
  if (!report.pdfStoragePath) {
    throw new NotFoundError('PDF for this report has not been generated yet — call POST .../pdf first');
  }
  return readFromStorage(report.pdfStoragePath);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the URL the frontend should use to download the PDF.
 * - MinIO mode: a real presigned URL, usable directly, valid for 1 hour.
 * - Local mode: an authenticated API path — the frontend calls this with
 *   its normal Bearer token, same as any other API request.
 */
async function buildDownloadReference(investigationId, storageKey) {
  if (getActiveStorageProviderName() === 'minio') {
    return getPresignedDownloadUrl(storageKey, 3600);
  }
  return `/api/v1/reports/${investigationId}/pdf/download`;
}
