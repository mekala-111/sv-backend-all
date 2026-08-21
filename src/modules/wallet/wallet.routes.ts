import { Router, Request, Response } from "express";
import { UserRole } from "../../types/enums";
import { VendorWallet, WalletTransaction } from "../../models";
import { ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { serializeMany } from "../../utils/serialize";

async function getBalance(req: Request, res: Response) {
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : (req.params.vendorId as string);
  const wallet = await VendorWallet.findOneAndUpdate(
    { vendorId },
    { $setOnInsert: { vendorId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return ok(res, wallet.toJSON());
}

async function listTransactions(req: Request, res: Response) {
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : (req.params.vendorId as string);
  const wallet = await VendorWallet.findOne({ vendorId }).lean();
  if (!wallet) return ok(res, []);

  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

  const filter = { walletId: wallet._id };
  const [items, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    WalletTransaction.countDocuments(filter),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

const router = Router();
router.use(authenticate, attachTenantScope);

router.get("/", requireRole(UserRole.VENDOR), getBalance);
router.get("/transactions", requireRole(UserRole.VENDOR), listTransactions);
router.get("/:vendorId", requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), getBalance);
router.get("/:vendorId/transactions", requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), listTransactions);

export default router;
