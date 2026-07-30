/**
 * AlertMind — Permission Middleware (RBAC)
 * Enforces role-based access control using ROLE_PERMISSIONS matrix.
 * Must be used AFTER requireAuth middleware.
 */

import { ForbiddenError } from '../../shared/errors/app.error.js';
import { ROLE_PERMISSIONS } from '../../shared/constants/security.constants.js';

/**
 * Middleware factory that checks if the authenticated user has the required permission.
 *
 * @param {string} permission - From PERMISSION constants
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(permission) {
  return (req, _res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('Authentication required before permission check'));
    }

    // API key with explicit permissions array
    if (Array.isArray(user.permissions)) {
      if (!user.permissions.includes(permission)) {
        return next(new ForbiddenError(`API key does not have permission: ${permission}`));
      }
      return next();
    }

    // Role-based permission check
    const allowedPermissions = ROLE_PERMISSIONS[user.role] || [];
    if (!allowedPermissions.includes(permission)) {
      return next(
        new ForbiddenError(
          `Role '${user.role}' does not have permission '${permission}'`
        )
      );
    }

    return next();
  };
}

/**
 * Middleware factory requiring the user to have one of multiple permissions (OR logic).
 * @param {string[]} permissions
 * @returns {import('express').RequestHandler}
 */
export function requireAnyPermission(permissions) {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(new ForbiddenError());

    const allowed = Array.isArray(user.permissions)
      ? user.permissions
      : ROLE_PERMISSIONS[user.role] || [];

    const hasAny = permissions.some((p) => allowed.includes(p));

    if (!hasAny) {
      return next(
        new ForbiddenError(`Required one of: ${permissions.join(', ')}`)
      );
    }

    return next();
  };
}

/**
 * Middleware that allows access only to OWNER or ADMIN roles.
 */
export function requireAdmin(req, _res, next) {
  const user = req.user;
  if (!user) return next(new ForbiddenError());

  if (!['OWNER', 'ADMIN'].includes(user.role)) {
    return next(new ForbiddenError('Admin role required'));
  }

  return next();
}
