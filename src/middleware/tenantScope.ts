import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { ApiError } from "../utils/apiResponse";
import { prisma } from "../config/prisma";

/**
 * Resolves req.auth.vendorId / req.auth.customerId from the DB if the access
 * token didn't carry them (e.g. right after a role change), and hard-blocks
 * cross-tenant access. This is the single choke point that guarantees
 * "Vendor A must never be able to access Vendor B's data."
 */
export async function attachTenantScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) throw ApiError.unauthorized();

  if (req.auth.role === UserRole.VENDOR && !req.auth.vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.auth.userId } });
    if (!vendor) throw ApiError.forbidden("No vendor profile linked to this account");
    req.auth.vendorId = vendor.id;
  }

  if (req.auth.role === UserRole.CUSTOMER && !req.auth.customerId) {
    const customer = await prisma.customer.findUnique({ where: { userId: req.auth.userId } });
    if (!customer) throw ApiError.forbidden("No customer profile linked to this account");
    req.auth.customerId = customer.id;
  }

  next();
}

/** Returns a Prisma `where` fragment scoping a query to the caller's tenant. SUPER_ADMIN/ADMIN see everything. */
export function vendorScopeWhere(req: Request): Record<string, unknown> {
  if (!req.auth) throw ApiError.unauthorized();
  if (req.auth.role === UserRole.SUPER_ADMIN || req.auth.role === UserRole.ADMIN) return {};
  if (req.auth.role === UserRole.VENDOR) return { vendorId: req.auth.vendorId };
  if (req.auth.role === UserRole.CUSTOMER) return { customerId: req.auth.customerId };
  throw ApiError.forbidden();
}

/** Throws if a fetched record's vendorId doesn't match the caller's tenant (defense in depth beyond the query filter). */
export function assertOwnsVendorRecord(req: Request, recordVendorId: string | null | undefined) {
  if (!req.auth) throw ApiError.unauthorized();
  if (req.auth.role === UserRole.SUPER_ADMIN || req.auth.role === UserRole.ADMIN) return;
  if (req.auth.role === UserRole.VENDOR && recordVendorId === req.auth.vendorId) return;
  throw ApiError.forbidden("You do not have access to this resource");
}
