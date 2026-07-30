/**
 * AlertMind — User Validation Schemas
 */

import { z } from 'zod';
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  PASSWORD_REGEX,
} from '../../shared/constants/security.constants.js';

export const registerSchema = z.object({
  name: z.string().min(2).max(MAX_NAME_LENGTH).trim(),
  email: z.string().email().max(MAX_EMAIL_LENGTH).toLowerCase().trim(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH)
    .regex(PASSWORD_REGEX, 'Password must contain uppercase, lowercase, number, and special character'),
  organizationName: z.string().min(2).max(255).trim(),
});

export const loginSchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LENGTH).toLowerCase().trim(),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH)
    .max(MAX_PASSWORD_LENGTH)
    .regex(PASSWORD_REGEX, 'Password must contain uppercase, lowercase, number, and special character'),
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: 'New password must differ from current password',
  path: ['newPassword'],
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(MAX_NAME_LENGTH).trim().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LENGTH).toLowerCase().trim(),
  role: z.enum(['ADMIN', 'ANALYST', 'VIEWER']),
  workspaceId: z.string().uuid().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});
