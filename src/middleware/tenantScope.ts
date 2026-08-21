import { NextFunction, Request, Response } from "express";
import { UserRole } from "../types/enums";
import { ApiError } from "../utils/apiResponse";
import { Vendor, Customer } from "../models";

/**
 * Resolves vendorId / customerId from DB when missing on the token,
 * and is the choke point that keeps Vendor A from reading Vendor B.
 */
export async function attachTenantScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) throw ApiError.unauthorized();

  if (req.auth.role === UserRole.VENDOR && !req.auth.vendorId) {
    const vendor = await Vendor.findOne({ userId: req.auth.userId });
    if (!vendor) throw ApiError.forbidden("No vendor profile linked to this account");
    req.auth.vendorId = vendor._id;
  }

  if (req.auth.role === UserRole.CUSTOMER && !req.auth.customerId) {
    const customer = await Customer.findOne({ userId: req.auth.userId });
    if (!customer) throw ApiError.forbidden("No customer profile linked to this account");
    req.auth.customerId = customer._id;
  }

  next();
}

/** Mongo filter fragment scoping a query to the caller's tenant. */
export function vendorScopeWhere(req: Request): Record<string, unknown> {
  if (!req.auth) throw ApiError.unauthorized();
  if (req.auth.role === UserRole.SUPER_ADMIN || req.auth.role === UserRole.ADMIN) return {};
  if (req.auth.role === UserRole.VENDOR) return { vendorId: req.auth.vendorId };
  if (req.auth.role === UserRole.CUSTOMER) return { customerId: req.auth.customerId };
  throw ApiError.forbidden();
}

export function assertOwnsVendorRecord(req: Request, recordVendorId: string | null | undefined) {
  if (!req.auth) throw ApiError.unauthorized();
  if (req.auth.role === UserRole.SUPER_ADMIN || req.auth.role === UserRole.ADMIN) return;
  if (req.auth.role === UserRole.VENDOR && recordVendorId === req.auth.vendorId) return;
  throw ApiError.forbidden("You do not have access to this resource");
}
