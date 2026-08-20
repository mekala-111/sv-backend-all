import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { ApiError } from "../utils/apiResponse";
import { prisma } from "../config/prisma";

/** Restricts a route to a fixed set of roles. SUPER_ADMIN and ADMIN are role-checked separately from tenant roles. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (!roles.includes(req.auth.role)) {
      throw ApiError.forbidden(`Requires one of roles: ${roles.join(", ")}`);
    }
    next();
  };
}

/**
 * Checks a fine-grained permission code (e.g. "events.publish") against the
 * role_permissions table, with user_permissions as an override layer.
 * SUPER_ADMIN always passes.
 */
export function requirePermission(code: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === UserRole.SUPER_ADMIN) return next();

    const permission = await prisma.permission.findUnique({ where: { code } });
    if (!permission) {
      // Unknown permission code is a server misconfiguration, not a user error.
      throw ApiError.forbidden(`Unknown permission: ${code}`);
    }

    const userOverride = await prisma.userPermission.findUnique({
      where: { userId_permissionId: { userId: req.auth.userId, permissionId: permission.id } },
    });
    if (userOverride) {
      if (userOverride.allow) return next();
      throw ApiError.forbidden("Permission revoked for this user");
    }

    const rolePermission = await prisma.rolePermission.findUnique({
      where: { role_permissionId: { role: req.auth.role, permissionId: permission.id } },
    });
    if (!rolePermission) throw ApiError.forbidden(`Missing permission: ${code}`);

    next();
  };
}
