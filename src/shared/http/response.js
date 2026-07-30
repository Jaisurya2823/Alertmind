/**
 * AlertMind — Standardized HTTP Response Helpers
 * All API responses use these helpers to ensure consistent structure.
 *
 * Success shape:  { success: true, data: T, meta?: M }
 * Error shape:    { success: false, error: string, code: string }
 */

import { HTTP_STATUS } from '../constants/app.constants.js';

/**
 * 200 OK — standard success response
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {unknown} [meta] - Pagination or other metadata
 */
export function ok(res, data, meta) {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    data,
    ...(meta !== undefined && { meta }),
  });
}

/**
 * 201 Created
 * @param {import('express').Response} res
 * @param {unknown} data
 */
export function created(res, data) {
  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data,
  });
}

/**
 * 202 Accepted — async operation started
 * @param {import('express').Response} res
 * @param {{ jobId: string, investigationId: string, [key: string]: unknown }} data
 */
export function accepted(res, data) {
  return res.status(HTTP_STATUS.ACCEPTED).json({
    success: true,
    data,
  });
}

/**
 * 204 No Content
 * @param {import('express').Response} res
 */
export function noContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).end();
}

/**
 * Paginated list response.
 * @param {import('express').Response} res
 * @param {unknown[]} items
 * @param {{ page: number, limit: number, total: number }} pagination
 */
export function paginated(res, items, pagination) {
  const { page, limit, total } = pagination;
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  });
}

/**
 * Streaming response — sets headers for Server-Sent Events.
 * Used for real-time AI analysis progress.
 * @param {import('express').Response} res
 */
export function initSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();
}

/**
 * Sends a single SSE event.
 * @param {import('express').Response} res
 * @param {string} event - Event type
 * @param {unknown} data
 */
export function sendSSEEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
