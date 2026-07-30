/**
 * AlertMind — Alert Validation Schemas (Zod)
 */

import { z } from 'zod';
import { ALERT_FORMAT, ALERT_SOURCE, SEVERITY } from '../../shared/constants/app.constants.js';

// ─── Submit Alert (text/JSON paste) ─────────────────────────────────────────
export const submitAlertBodySchema = z.object({
  rawInput: z
    .string()
    .min(10, 'Alert input must be at least 10 characters')
    .max(10 * 1024 * 1024, 'Alert input exceeds 10MB limit'),

  inputFormat: z.enum(Object.values(ALERT_FORMAT)).optional(),
  source: z.enum(Object.values(ALERT_SOURCE)).optional(),
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

// ─── Upload Alert File ───────────────────────────────────────────────────────
export const uploadAlertBodySchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
  inputFormat: z.enum(Object.values(ALERT_FORMAT)).optional(),
  source: z.enum(Object.values(ALERT_SOURCE)).optional(),
});

// ─── List Alerts Query ───────────────────────────────────────────────────────
export const listAlertsQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED']).optional(),
  severity: z.enum(Object.values(SEVERITY)).optional(),
  source: z.enum(Object.values(ALERT_SOURCE)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'severity', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// ─── Alert ID param ──────────────────────────────────────────────────────────
export const alertIdParamSchema = z.object({
  id: z.string().uuid('Invalid alert ID'),
});
