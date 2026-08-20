import { Router, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";

async function overview(_req: Request, res: Response) {
  const [vendors, customers, events, liveEvents, pendingVendors] = await Promise.all([
    prisma.vendor.count(),
    prisma.customer.count(),
    prisma.event.count(),
    prisma.event.count({ where: { status: "LIVE" } }),
    prisma.vendor.count({ where: { status: "PENDING_APPROVAL" } }),
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
    prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.count({ where }),
  ]);
  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

async function listPermissions(_req: Request, res: Response) {
  const permissions = await prisma.permission.findMany({ orderBy: { module: "asc" } });
  return ok(res, permissions);
}

async function listRolePermissions(req: Request, res: Response) {
  const role = req.params.role as UserRole;
  const rolePermissions = await prisma.rolePermission.findMany({ where: { role }, include: { permission: true } });
  return ok(res, rolePermissions);
}

async function grantRolePermission(req: Request, res: Response) {
  const role = req.params.role as UserRole;
  const { permissionCode } = req.body as { permissionCode: string };
  const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
  if (!permission) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Unknown permission code" } });

  const grant = await prisma.rolePermission.upsert({
    where: { role_permissionId: { role, permissionId: permission.id } },
    create: { role, permissionId: permission.id },
    update: {},
  });
  return ok(res, grant);
}

async function revokeRolePermission(req: Request, res: Response) {
  const role = req.params.role as UserRole;
  const { permissionCode } = req.body as { permissionCode: string };
  const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
  if (!permission) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Unknown permission code" } });

  await prisma.rolePermission.deleteMany({ where: { role, permissionId: permission.id } });
  return ok(res, { revoked: true });
}

const router = Router();
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

router.get("/overview", overview);
router.get("/audit-logs", listAuditLogs);
router.get("/permissions", listPermissions);
router.get("/permissions/role/:role", listRolePermissions);
router.post("/permissions/role/:role/grant", requireRole(UserRole.SUPER_ADMIN), grantRolePermission);
router.post("/permissions/role/:role/revoke", requireRole(UserRole.SUPER_ADMIN), revokeRolePermission);

export default router;
