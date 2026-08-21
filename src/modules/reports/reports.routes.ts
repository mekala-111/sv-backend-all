import { Router, Request, Response } from "express";
import { UserRole, PaymentStatus } from "../../types/enums";
import { Event, Payment, Vendor } from "../../models";
import { ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope, vendorScopeWhere } from "../../middleware/tenantScope";

async function eventsSummary(req: Request, res: Response) {
  const where = vendorScopeWhere(req);
  const grouped = await Event.aggregate([
    { $match: where },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return ok(res, grouped.map((g: { _id: string; count: number }) => ({ status: g._id, count: g.count })));
}

async function revenueSummary(req: Request, res: Response) {
  const where = { ...vendorScopeWhere(req), status: PaymentStatus.SUCCESS };
  const result = await Payment.aggregate([
    { $match: where },
    { $group: { _id: null, totalRevenue: { $sum: "$amount" }, successfulPayments: { $sum: 1 } } },
  ]);
  return ok(res, {
    totalRevenue: result[0]?.totalRevenue ?? 0,
    successfulPayments: result[0]?.successfulPayments ?? 0,
  });
}

async function topVendorsByEvents(_req: Request, res: Response) {
  const grouped = await Event.aggregate([
    { $group: { _id: "$vendorId", eventCount: { $sum: 1 } } },
    { $sort: { eventCount: -1 } },
    { $limit: 10 },
  ]);
  const vendorIds = grouped.map((g: { _id: string }) => g._id);
  const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("companyName").lean();
  const nameById = new Map(vendors.map((v: { _id: string; companyName: string }) => [v._id, v.companyName]));

  return ok(
    res,
    grouped.map((g: { _id: string; eventCount: number }) => ({
      vendorId: g._id,
      companyName: nameById.get(g._id),
      eventCount: g.eventCount,
    }))
  );
}

const router = Router();
router.use(authenticate, attachTenantScope, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR));

router.get("/events-summary", eventsSummary);
router.get("/revenue-summary", revenueSummary);
router.get("/top-vendors", requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), topVendorsByEvents);

export default router;
