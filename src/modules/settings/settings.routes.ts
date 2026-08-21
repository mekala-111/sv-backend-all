import { Router, Request, Response } from "express";
import { UserRole } from "../../types/enums";
import { Setting } from "../../models";
import { ApiError, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { writeAuditLog } from "../../middleware/auditLog";

async function listSettings(_req: Request, res: Response) {
  const settings = await Setting.find();
  return ok(res, settings.map((s: { toJSON: () => unknown }) => s.toJSON()));
}

async function getSetting(req: Request, res: Response) {
  const setting = await Setting.findById(req.params.key);
  if (!setting) throw ApiError.notFound();
  return ok(res, setting.toJSON());
}

async function upsertSetting(req: Request, res: Response) {
  const { value } = req.body as { value: unknown };
  const setting = await Setting.findOneAndUpdate(
    { _id: req.params.key },
    { $set: { value }, $setOnInsert: { _id: req.params.key } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await writeAuditLog(req, { action: "UPDATE", module: "settings", entityId: req.params.key, newData: value });
  return ok(res, setting.toJSON());
}

const router = Router();
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

router.get("/", listSettings);
router.get("/:key", getSetting);
router.put("/:key", upsertSetting);

export default router;
