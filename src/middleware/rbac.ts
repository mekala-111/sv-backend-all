import { NextFunction, Request, Response } from "express";
import { UserRole } from "../types/enums";
import { ApiError } from "../utils/apiResponse";
import { Permission, RolePermission, UserPermission, Vendor, Customer } from "../models";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (!roles.includes(req.auth.role)) {
      throw ApiError.forbidden(`Requires one of roles: ${roles.join(", ")}`);
    }
    next();
  };
}

export function requirePermission(code: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === UserRole.SUPER_ADMIN) return next();

    const permission = await Permission.findOne({ code });
    if (!permission) throw ApiError.forbidden(`Unknown permission: ${code}`);

    const userOverride = await UserPermission.findOne({
      userId: req.auth.userId,
      permissionId: permission._id,
    });
    if (userOverride) {
      if (userOverride.allow) return next();
      throw ApiError.forbidden("Permission revoked for this user");
    }

    const rolePermission = await RolePermission.findOne({
      role: req.auth.role,
      permissionId: permission._id,
    });
    if (!rolePermission) throw ApiError.forbidden(`Missing permission: ${code}`);

    next();
  };
}

// Re-export tenant helpers used alongside RBAC in some modules
export { Vendor, Customer };
