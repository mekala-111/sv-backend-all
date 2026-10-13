import { Request, Response } from "express";
import { UserRole, UserStatus } from "../../types/enums";
import { User, Customer, Event } from "../../models";
import { hashPassword } from "../../utils/password";
import { generateCode } from "../../utils/slug";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { vendorScopeWhere, assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";
import { serialize, serializeMany } from "../../utils/serialize";
import { runInTransaction } from "../../utils/transaction";

export async function createCustomer(req: Request, res: Response) {
  const { name, email, password, phone } = req.body;
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : req.body.vendorId;
  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const existingUser = await User.findOne({ email });
  if (existingUser) throw ApiError.conflict("Email already in use");

  const passwordHash = await hashPassword(password);

  const customer = await runInTransaction(async (session) => {
    const [user] = await User.create(
      [{ name, email, phone, passwordHash, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE }],
      { session }
    );
    const [created] = await Customer.create(
      [{ userId: user._id, vendorId, customerCode: generateCode("CUS"), name, phone, email }],
      { session }
    );
    return created;
  });

  await writeAuditLog(req, { action: "CREATE", module: "customers", entityId: customer._id, newData: customer.toJSON() });
  return created(res, customer.toJSON());
}

export async function listCustomers(req: Request, res: Response) {
  const where: Record<string, unknown> = { ...vendorScopeWhere(req) };
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

  if (req.query.status) where.status = req.query.status;

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search) {
    where.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { customerCode: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Customer.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Customer.countDocuments(where),
  ]);

  const customerIds = items.map((c: { _id: string }) => c._id);
  const eventCounts = await Event.aggregate([
    { $match: { customerId: { $in: customerIds } } },
    { $group: { _id: "$customerId", count: { $sum: 1 } } },
  ]);
  const countById = new Map(eventCounts.map((e: { _id: string; count: number }) => [e._id, e.count]));

  const data = serializeMany(items as Record<string, unknown>[]).map((c) => ({
    ...c,
    eventsCount: countById.get(c.id) ?? 0,
  }));

  return ok(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function getCustomer(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) throw ApiError.notFound();
  assertOwnsVendorRecord(req, customer.vendorId);
  return ok(res, serialize(customer as Record<string, unknown>));
}

export async function updateCustomer(req: Request, res: Response) {
  const existing = await Customer.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  const oldData = existing.toJSON();
  Object.assign(existing, req.body);
  await existing.save();
  await writeAuditLog(req, {
    action: "UPDATE",
    module: "customers",
    entityId: existing._id,
    oldData,
    newData: req.body,
  });
  return ok(res, existing.toJSON());
}
