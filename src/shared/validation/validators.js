/**
 * AlertMind — Reusable Zod Validators
 * Common field validators used across multiple schemas.
 */

import { z } from 'zod';
import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_NAME_LENGTH,
  PASSWORD_REGEX,
} from '../constants/security.constants.js';

// ─── Primitives ───────────────────────────────────────────────────────────────
export const uuidSchema = z.string().uuid('Must be a valid UUID');

export const emailSchema = z
  .string()
  .email('Must be a valid email address')
  .max(MAX_EMAIL_LENGTH)
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH)
  .regex(PASSWORD_REGEX, 'Password must contain uppercase, lowercase, number, and special character');

export const nameSchema = z.string().min(2).max(MAX_NAME_LENGTH).trim();

// ─── Pagination ───────────────────────────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Security-specific ────────────────────────────────────────────────────────
export const severitySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']);

export const ipv4Schema = z
  .string()
  .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Must be a valid IPv4 address');

export const sha256Schema = z
  .string()
  .length(64)
  .regex(/^[a-fA-F0-9]{64}$/, 'Must be a valid SHA-256 hash');

export const md5Schema = z
  .string()
  .length(32)
  .regex(/^[a-fA-F0-9]{32}$/, 'Must be a valid MD5 hash');

export const mitreIdSchema = z
  .string()
  .regex(/^T\d{4}(\.\d{3})?$/, 'Must be a valid MITRE technique ID (e.g. T1059.001)');

export const tacticIdSchema = z
  .string()
  .regex(/^TA\d{4}$/, 'Must be a valid MITRE tactic ID (e.g. TA0002)');
