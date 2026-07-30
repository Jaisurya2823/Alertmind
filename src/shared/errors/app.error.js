/**
 * AlertMind — Application Error Classes
 * All thrown errors extend AppError for consistent handling
 */

import { HTTP_STATUS } from '../constants/app.constants.js';

/**
 * Base application error.
 * All intentional errors should extend this class.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Machine-readable error code
   * @param {Record<string, unknown>} [context] - Additional debug context
   */
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, code = 'INTERNAL_ERROR', context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.isOperational = true; // Distinguishes from programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = '') {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  /**
   * @param {string} message
   * @param {Record<string, string[]>} [fieldErrors]
   */
  constructor(message, fieldErrors = {}) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR');
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }
}

export class BadRequestError extends AppError {
  constructor(message) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST');
  }
}
