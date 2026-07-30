/**
 * AlertMind — Report Schemas
 */

import { z } from 'zod';

export const reportIdParamSchema = z.object({
  investigationId: z.string().uuid('Invalid investigation ID'),
});

export const exportQuerySchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID').optional(),
  format: z.enum(['markdown', 'pdf', 'html', 'json']).default('markdown'),
});
