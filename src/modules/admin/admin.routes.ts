import { Router, Request, Response } from "express";
import { UserRole, VendorStatus, EventStatus, PaymentStatus } from "../../types/enums";
import {
  Vendor,
  Customer,
  Event,
  AuditLog,
  Permission,
  RolePermission,
  User,
  Payment,
  Booking,
} from "../../models";
import { ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { serialize, serializeMany } from "../../utils/serialize";

async function overview(_req: Request, res: Response) {
  const [vendors, customers, events, liveEvents, pendingVendors] = await Promise.all([
    Vendor.countDocuments(),
    Customer.countDocuments(),
    Event.countDocuments(),
    Event.countDocuments({ status: EventStatus.LIVE }),
    Vendor.countDocuments({ status: VendorStatus.PENDING_APPROVAL }),
  ]);
  return ok(res, { vendors, customers, events, liveEvents, pendingVendors });
}

async function listAuditLogs(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const where: Record<string, unknown> = {};
  if (req.query.module) where.module = req.query.module;
  if (req.query.userId) where.userId = req.query.userId;

  const [items, total] = await Promise.all([
    AuditLog.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(where),
  ]);
  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

async function listPermissions(_req: Request, res: Response) {
  const permissions = await Permission.find().sort({ module: 1 }).lean();
  return ok(res, serializeMany(permissions as Record<string, unknown>[]));
}

async function listRolePermissions(req: Request, res: Response) {
  const role = req.params.role as UserRole;
  const rolePermissions = await RolePermission.find({ role }).lean();
  const permissionIds = rolePermissions.map((rp: { permissionId: string }) => rp.permissionId);
  const permissions = await Permission.find({ _id: { $in: permissionIds } }).lean();
  const permById = new Map(permissions.map((p: { _id: string }) => [p._id, p]));

  return ok(
    res,
    rolePermissions.map((rp: { permissionId: string } & Record<string, unknown>) => ({
      ...serialize(rp),
      permission: serialize(permById.get(rp.permissionId) as Record<string, unknown> | undefined),
    }))
  );
}

async function grantRolePermission(req: Request, res: Response) {
  const role = req.params.role as UserRole;
  const { permissionCode } = req.body as { permissionCode: string };
  const permission = await Permission.findOne({ code: permissionCode });
  if (!permission) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Unknown permission code" } });
  }

  const grant = await RolePermission.findOneAndUpdate(
    { role, permissionId: permission._id },
    { $setOnInsert: { role, permissionId: permission._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return ok(res, grant.toJSON());
}

async function revokeRolePermission(req: Request, res: Response) {
  const role = req.params.role as UserRole;
  const { permissionCode } = req.body as { permissionCode: string };
  const permission = await Permission.findOne({ code: permissionCode });
  if (!permission) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Unknown permission code" } });
  }

  await RolePermission.deleteMany({ role, permissionId: permission._id });
  return ok(res, { revoked: true });
}

async function listAdminUsers(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const where = { role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] } };

  const [items, total] = await Promise.all([
    User.find(where)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

async function analytics(_req: Request, res: Response) {
  const [vendors, customers, events, liveEvents, revenueAgg] = await Promise.all([
    Vendor.countDocuments(),
    Customer.countDocuments(),
    Event.countDocuments(),
    Event.countDocuments({ status: EventStatus.LIVE }),
    Payment.aggregate([
      { $match: { status: PaymentStatus.SUCCESS } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return ok(res, {
    vendors,
    customers,
    events,
    liveEvents,
    revenue: revenueAgg[0]?.total ?? 0,
    successfulPayments: revenueAgg[0]?.count ?? 0,
  });
}

async function listBookings(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const where: Record<string, unknown> = {};
  if (req.query.status) where.status = req.query.status;

  const [items, total] = await Promise.all([
    Booking.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Booking.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

const router = Router();
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

router.get("/overview", overview);
router.get("/analytics", analytics);
router.get("/users", listAdminUsers);
router.get("/bookings", listBookings);
router.get("/audit-logs", listAuditLogs);
router.get("/permissions", listPermissions);
router.get("/permissions/role/:role", listRolePermissions);
router.post("/permissions/role/:role/grant", requireRole(UserRole.SUPER_ADMIN), grantRolePermission);
router.post("/permissions/role/:role/revoke", requireRole(UserRole.SUPER_ADMIN), revokeRolePermission);

export default router;
