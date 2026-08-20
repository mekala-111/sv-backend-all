import { Router, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope, vendorScopeWhere } from "../../middleware/tenantScope";

async function eventsSummary(req: Request, res: Response) {
  const where = vendorScopeWhere(req);
  const grouped = await prisma.event.groupBy({ by: ["status"], where, _count: { _all: true } });
  return ok(res, grouped.map((g) => ({ status: g.status, count: g._count._all })));
}

async function revenueSummary(req: Request, res: Response) {
  const where = { ...vendorScopeWhere(req), status: "SUCCESS" as const };
  const result = await prisma.payment.aggregate({ where, _sum: { amount: true }, _count: { _all: true } });
  return ok(res, { totalRevenue: result._sum.amount ?? 0, successfulPayments: result._count._all });
}

async function topVendorsByEvents(_req: Request, res: Response) {
  const grouped = await prisma.event.groupBy({
    by: ["vendorId"],
    _count: { _all: true },
    orderBy: { _count: { vendorId: "desc" } },
    take: 10,
  });
  const vendorIds = grouped.map((g) => g.vendorId);
  const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, companyName: true } });
  const nameById = new Map(vendors.map((v) => [v.id, v.companyName]));

  return ok(
    res,
    grouped.map((g) => ({ vendorId: g.vendorId, companyName: nameById.get(g.vendorId), eventCount: g._count._all }))
  );
}

const router = Router();
router.use(authenticate, attachTenantScope, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR));

router.get("/events-summary", eventsSummary);
router.get("/revenue-summary", revenueSummary);
router.get("/top-vendors", requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), topVendorsByEvents);

export default router;
