/**
 * AlertMind — User Controller
 */

import { registerUser, loginUser, logoutUser, changePassword } from './user.service.js';
import { getPrismaClient } from '../../bootstrap/startup.js';
import { ok, created } from '../../shared/http/response.js';
import { AUDIT_ACTION } from '../../shared/constants/security.constants.js';
import { createAuditLog } from '../audit/audit.service.js';

export async function registerHandler(req, res, next) {
  try {
    const result = await registerUser(req.body);

    await createAuditLog({
      userId: result.userId,
      action: AUDIT_ACTION.REGISTER,
      resource: 'user',
      resourceId: result.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return created(res, { userId: result.userId, organizationId: result.organizationId });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const result = await loginUser(req.body, req.ip);

    await createAuditLog({
      userId: result.user.id,
      action: AUDIT_ACTION.LOGIN,
      resource: 'user',
      resourceId: result.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return ok(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req, res, next) {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) await logoutUser(token);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.LOGOUT,
      resource: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return ok(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getMeHandler(req, res, next) {
  try {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, role: true,
        organizationId: true, lastLoginAt: true, createdAt: true,
        organization: { select: { id: true, name: true, plan: true } },
        workspaceUsers: {
          select: { workspace: { select: { id: true, name: true, isDefault: true } }, role: true },
        },
      },
    });
    return ok(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePassword(req.user.id, currentPassword, newPassword);

    await createAuditLog({
      userId: req.user.id,
      action: AUDIT_ACTION.PASSWORD_CHANGE,
      resource: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return ok(res, { message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileHandler(req, res, next) {
  try {
    const prisma = getPrismaClient();
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
      select: { id: true, email: true, name: true, role: true, updatedAt: true },
    });
    return ok(res, updated);
  } catch (err) {
    next(err);
  }
}
