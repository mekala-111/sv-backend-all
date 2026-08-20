import { Router, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";

async function getBalance(req: Request, res: Response) {
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : (req.params.vendorId as string);
  const wallet = await prisma.vendorWallet.upsert({ where: { vendorId }, create: { vendorId }, update: {} });
  return ok(res, wallet);
}

async function listTransactions(req: Request, res: Response) {
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : (req.params.vendorId as string);
  const wallet = await prisma.vendorWallet.findUnique({ where: { vendorId } });
  if (!wallet) return ok(res, []);

  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
  ]);

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

const router = Router();
router.use(authenticate, attachTenantScope);

router.get("/", requireRole(UserRole.VENDOR), getBalance);
router.get("/transactions", requireRole(UserRole.VENDOR), listTransactions);
router.get("/:vendorId", requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), getBalance);
router.get("/:vendorId/transactions", requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), listTransactions);

export default router;
