/**
 * AlertMind — Global Error Middleware
 * Must be the LAST middleware registered in app.js
 * Handles: AppError, ZodError, Prisma errors, Multer errors, unexpected errors
 */

import * as Sentry from '@sentry/node';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../errors/app.error.js';
import logger from '../logger/logger.js';
import { HTTP_STATUS } from '../constants/app.constants.js';

/**
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorMiddleware(err, req, res, _next) {
  const requestId = req.id || req.headers['x-request-id'];

  // ─── 1. Operational errors (AppError subclasses) ─────────────────────────
  if (err instanceof AppError && err.isOperational) {
    logger.warn(
      { err, requestId, url: req.url, method: req.method },
      `[${err.code}] ${err.message}`
    );

    const body = {
      success: false,
      error: err.message,
      code: err.code,
      requestId,
    };

    if (err instanceof ValidationError && err.fieldErrors) {
      body.fieldErrors = err.fieldErrors;
    }

    return res.status(err.statusCode).json(body);
  }

  // ─── 2. Zod validation errors ─────────────────────────────────────────────
  if (err.name === 'ZodError') {
    const formatted = err.flatten ? err.flatten() : { fieldErrors: {}, formErrors: [] };
    logger.warn({ requestId, zodErrors: formatted }, 'Zod validation error');
    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      fieldErrors: formatted.fieldErrors,
      requestId,
    });
  }

  // ─── 3. Prisma errors ─────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaKnownError(err, res, requestId);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn({ requestId, err: err.message }, 'Prisma validation error');
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Database query validation failed',
      code: 'DB_VALIDATION_ERROR',
      requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.fatal({ err }, 'Prisma initialization error — database unreachable');
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      success: false,
      error: 'Database service unavailable',
      code: 'DB_UNAVAILABLE',
      requestId,
    });
  }

  // ─── 4. Multer (file upload) errors ──────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: `File exceeds maximum allowed size`,
      code: 'FILE_TOO_LARGE',
      requestId,
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Unexpected file field in upload',
      code: 'UNEXPECTED_FILE',
      requestId,
    });
  }

  // ─── 5. JWT / Auth errors ─────────────────────────────────────────────────
  if (err.code === 'ERR_JWS_INVALID' || err.code === 'ERR_JWT_EXPIRED' || err.name === 'JWTExpired') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: 'Invalid or expired authentication token',
      code: 'TOKEN_INVALID',
      requestId,
    });
  }

  // ─── 6. CSRF errors ───────────────────────────────────────────────────────
  if (err.code === 'EBADCSRFTOKEN' || err.message === 'invalid csrf token') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID',
      requestId,
    });
  }

  // ─── 7. SyntaxError (malformed JSON body) ────────────────────────────────
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Malformed JSON in request body',
      code: 'INVALID_JSON',
      requestId,
    });
  }

  // ─── 8. PayloadTooLarge ───────────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Request body exceeds maximum allowed size',
      code: 'PAYLOAD_TOO_LARGE',
      requestId,
    });
  }

  // ─── 9. Unexpected / programmer errors ───────────────────────────────────
  // These are NOT operational — report to Sentry and log as fatal
  Sentry.captureException(err, {
    extra: {
      requestId,
      url: req.url,
      method: req.method,
      userAgent: req.get('user-agent'),
    },
    user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
  });

  logger.error(
    { err, requestId, url: req.url, method: req.method },
    'Unhandled server error'
  );

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: 'An unexpected error occurred. Our team has been notified.',
    code: 'INTERNAL_ERROR',
    requestId,
  });
}

/**
 * Maps Prisma known error codes to HTTP responses.
 * @param {Prisma.PrismaClientKnownRequestError} err
 * @param {import('express').Response} res
 * @param {string} requestId
 */
function handlePrismaKnownError(err, res, requestId) {
  logger.warn({ code: err.code, meta: err.meta, requestId }, 'Prisma known error');

  switch (err.code) {
    // Unique constraint violation
    case 'P2002': {
      const field = err.meta?.target ?? 'field';
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: `A record with this ${Array.isArray(field) ? field.join(', ') : field} already exists`,
        code: 'DUPLICATE_RECORD',
        requestId,
      });
    }
    // Record not found
    case 'P2025':
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
        requestId,
      });
    // Foreign key constraint
    case 'P2003':
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Related record does not exist',
        code: 'FOREIGN_KEY_VIOLATION',
        requestId,
      });
    // Required field missing
    case 'P2011':
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Required field is null',
        code: 'NULL_CONSTRAINT',
        requestId,
      });
    default:
      logger.error({ err }, 'Unhandled Prisma error code');
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Database operation failed',
        code: 'DB_ERROR',
        requestId,
      });
  }
}
