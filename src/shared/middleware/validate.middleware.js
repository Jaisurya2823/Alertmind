/**
 * AlertMind — Request Validation Middleware
 * Zod schema validation for body, params, and query
 */

import { z } from 'zod';
import { ValidationError } from '../errors/app.error.js';

/**
 * Middleware factory that validates request data against a Zod schema.
 * Supports validating: body, params, query, or any combination.
 *
 * Usage:
 *   router.post('/alerts', validate({ body: alertSubmitSchema }), controller)
 *
 * @param {{ body?: z.ZodSchema, params?: z.ZodSchema, query?: z.ZodSchema }} schemas
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const errors = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        const flat = result.error.flatten();
        Object.assign(errors, flat.fieldErrors);
      } else {
        // Replace body with parsed (coerced + stripped) data
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        const flat = result.error.flatten();
        // Prefix param errors to distinguish from body errors
        for (const [key, val] of Object.entries(flat.fieldErrors)) {
          errors[`params.${key}`] = val;
        }
      } else {
        req.params = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        const flat = result.error.flatten();
        for (const [key, val] of Object.entries(flat.fieldErrors)) {
          errors[`query.${key}`] = val;
        }
      } else {
        req.query = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      return next(new ValidationError('Request validation failed', errors));
    }

    return next();
  };
}

// ─── Common reusable param schemas ───────────────────────────────────────────

export const uuidParam = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
