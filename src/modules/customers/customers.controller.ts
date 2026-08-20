import { Request, Response } from "express";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { hashPassword } from "../../utils/password";
import { generateCode } from "../../utils/slug";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { vendorScopeWhere, assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";

export async function createCustomer(req: Request, res: Response) {
  const { name, email, password, phone } = req.body;
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : req.body.vendorId;
  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw ApiError.conflict("Email already in use");

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, phone, passwordHash, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
    });
    const customer = await tx.customer.create({
      data: { userId: user.id, vendorId, customerCode: generateCode("CUS"), name, phone, email },
    });
    return customer;
  });

  await writeAuditLog(req, { action: "CREATE", module: "customers", entityId: result.id, newData: result });
  return created(res, result);
}

export async function listCustomers(req: Request, res: Response) {
  const where: any = vendorScopeWhere(req);
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

  if (req.query.status) where.status = req.query.status;

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { customerCode: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { events: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  const data = items.map(({ _count, ...c }) => ({ ...c, eventsCount: _count.events }));

  return ok(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function getCustomer(req: Request, res: Response) {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw ApiError.notFound();
  assertOwnsVendorRecord(req, customer.vendorId);
  return ok(res, customer);
}

export async function updateCustomer(req: Request, res: Response) {
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
  await writeAuditLog(req, { action: "UPDATE", module: "customers", entityId: customer.id, oldData: existing, newData: req.body });
  return ok(res, customer);
}
