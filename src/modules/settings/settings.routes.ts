import { Router, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog } from "../../middleware/auditLog";

async function listSettings(_req: Request, res: Response) {
  const settings = await prisma.setting.findMany();
  return ok(res, settings);
}

async function getSetting(req: Request, res: Response) {
  const setting = await prisma.setting.findUnique({ where: { key: req.params.key } });
  if (!setting) throw ApiError.notFound();
  return ok(res, setting);
}

async function upsertSetting(req: Request, res: Response) {
  const { value } = req.body as { value: unknown };
  const setting = await prisma.setting.upsert({
    where: { key: req.params.key },
    create: { key: req.params.key, value: value as any },
    update: { value: value as any },
  });
  await writeAuditLog(req, { action: "UPDATE", module: "settings", entityId: setting.key, newData: value });
  return ok(res, setting);
}

const router = Router();
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

router.get("/", listSettings);
router.get("/:key", getSetting);
router.put("/:key", upsertSetting);

export default router;
