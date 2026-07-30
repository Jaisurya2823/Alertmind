/**
 * AlertMind — Generic API Schemas
 */

import { z } from 'zod';

export const paginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string(),
  requestId: z.string().optional(),
  fieldErrors: z.record(z.array(z.string())).optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Must be a valid UUID'),
});

export const workspaceHeaderSchema = z.object({
  'x-workspace-id': z.string().uuid().optional(),
});
