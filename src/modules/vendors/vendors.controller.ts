import { Request, Response } from "express";
import { UserRole, UserStatus, VendorStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { hashPassword } from "../../utils/password";
import { generateCode } from "../../utils/slug";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../middleware/auditLog";

export async function createVendor(req: Request, res: Response) {
  const { name, email, password, phone, companyName, logo, address, planId, whatsappNumber } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw ApiError.conflict("Email already in use");

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, phone, passwordHash, role: UserRole.VENDOR, status: UserStatus.ACTIVE },
    });
    const vendor = await tx.vendor.create({
      data: {
        userId: user.id,
        companyName,
        vendorCode: generateCode("VEN"),
        logo,
        phone,
        email,
        address,
        planId,
        whatsappNumber,
        status: VendorStatus.ACTIVE,
      },
    });
    await tx.vendorWallet.create({ data: { vendorId: vendor.id } });
    return { user, vendor };
  });

  await writeAuditLog(req, { action: "CREATE", module: "vendors", entityId: result.vendor.id, newData: result.vendor });
  return created(res, result.vendor);
}

export async function listVendors(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const where = search
    ? { OR: [{ companyName: { contains: search } }, { email: { contains: search } }, { vendorCode: { contains: search } }] }
    : {};

  const [items, total] = await Promise.all([
    prisma.vendor.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.vendor.count({ where }),
  ]);

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function getVendor(req: Request, res: Response) {
  const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!vendor) throw ApiError.notFound();
  return ok(res, vendor);
}

/** Vendor's own profile — resolved from req.auth rather than a path param, so a vendor can never view another's profile by ID. */
export async function getMyVendorProfile(req: Request, res: Response) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: req.auth!.vendorId! },
    include: { wallet: true },
  });
  if (!vendor) throw ApiError.notFound();
  return ok(res, vendor);
}

export async function updateVendor(req: Request, res: Response) {
  const existing = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();

  const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data: req.body });
  await writeAuditLog(req, { action: "UPDATE", module: "vendors", entityId: vendor.id, oldData: existing, newData: req.body });
  return ok(res, vendor);
}

export async function deleteVendor(req: Request, res: Response) {
  const existing = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  // Soft-delete via status rather than a hard delete, to preserve historical events/payments.
  const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data: { status: VendorStatus.INACTIVE } });
  await writeAuditLog(req, { action: "DELETE", module: "vendors", entityId: vendor.id, oldData: existing });
  return ok(res, vendor);
}
