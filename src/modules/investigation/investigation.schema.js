/**
 * AlertMind — Investigation Validation Schemas
 */

import { z } from 'zod';

export const investigationIdParamSchema = z.object({
  id: z.string().uuid('Invalid investigation ID'),
});

export const listInvestigationsQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW']).optional(),
  threatCategory: z.string().max(100).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'updatedAt', 'processingTimeMs']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
