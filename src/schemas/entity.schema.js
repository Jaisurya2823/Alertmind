/**
 * AlertMind — Entity & IOC Zod Schemas
 */

import { z } from 'zod';
import { ENTITY_TYPE, IOC_TYPE, TLP } from '../shared/constants/app.constants.js';

export const entitySchema = z.object({
  type: z.enum(Object.values(ENTITY_TYPE)),
  value: z.string().min(1).max(2048),
  context: z.string().max(500).optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export const iocSchema = z.object({
  type: z.enum(Object.values(IOC_TYPE)),
  value: z.string().min(1).max(2048),
  malicious: z.boolean().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  tlp: z.enum(Object.values(TLP)).default('AMBER'),
  enrichmentData: z.record(z.unknown()).optional().nullable(),
});
