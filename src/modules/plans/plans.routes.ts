import { Router, Request, Response } from "express";
import { UserRole, PlanStatus } from "../../types/enums";
import { Plan, Vendor, VendorPricing } from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";
import { serialize, serializeMany } from "../../utils/serialize";

async function listPlans(req: Request, res: Response) {
  const where: Record<string, unknown> = {};
  if (req.query.status) where.status = req.query.status;
  else if (req.auth!.role === UserRole.VENDOR) where.status = PlanStatus.ACTIVE;

  const plans = await Plan.find(where).sort({ price: 1 }).lean();
  return ok(res, serializeMany(plans as Record<string, unknown>[]));
}

async function createPlan(req: Request, res: Response) {
  const existing = await Plan.findOne({ code: req.body.code });
  if (existing) throw ApiError.conflict("Plan code already exists");

  const plan = await Plan.create(req.body);
  await writeAuditLog(req, { action: "CREATE", module: "plans", entityId: plan._id, newData: plan.toJSON() });
  return created(res, plan.toJSON());
}

async function updatePlan(req: Request, res: Response) {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound();

  const oldData = plan.toJSON();
  Object.assign(plan, req.body);
  await plan.save();
  await writeAuditLog(req, { action: "UPDATE", module: "plans", entityId: plan._id, oldData, newData: req.body });
  return ok(res, plan.toJSON());
}

async function assignVendor(req: Request, res: Response) {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound();

  const { vendorId } = req.body as { vendorId?: string };
  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  vendor.planId = plan._id;
  await vendor.save();
  await writeAuditLog(req, {
    action: "ASSIGN",
    module: "plans",
    entityId: plan._id,
    newData: { vendorId, planId: plan._id },
  });
  return ok(res, { vendorId, planId: plan._id });
}

async function getVendorPricing(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  const pricing = await VendorPricing.findOne({ vendorId }).lean();
  return ok(res, pricing ? serialize(pricing as Record<string, unknown>) : { vendorId, items: [] });
}

async function upsertVendorPricing(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  const { items } = req.body as { items?: unknown[] };
  if (!Array.isArray(items)) throw ApiError.badRequest("items array is required");

  const pricing = await VendorPricing.findOneAndUpdate(
    { vendorId },
    { $set: { items, vendorId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await writeAuditLog(req, { action: "UPDATE", module: "vendor_pricing", entityId: pricing._id, newData: { items } });
  return ok(res, pricing.toJSON());
}

const plansRouter = Router();
plansRouter.use(authenticate, attachTenantScope);

const adminOnly = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN);
const adminOrVendor = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR);

plansRouter.get("/", adminOrVendor, listPlans);
plansRouter.post("/", adminOnly, createPlan);
plansRouter.patch("/:id", adminOnly, updatePlan);
plansRouter.post("/:id/assign-vendor", adminOnly, assignVendor);

const vendorPricingRouter = Router();
vendorPricingRouter.use(authenticate, attachTenantScope, requireRole(UserRole.VENDOR));
vendorPricingRouter.get("/pricing", getVendorPricing);
vendorPricingRouter.put("/pricing", upsertVendorPricing);

export { vendorPricingRouter };
export default plansRouter;
