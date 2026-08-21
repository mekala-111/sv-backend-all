import { Router, Request, Response } from "express";
import { UserRole } from "../../types/enums";
import { Recording, Event } from "../../models";
import { ApiError, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope, vendorScopeWhere, assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";
import { serialize, serializeMany } from "../../utils/serialize";

async function listRecordings(req: Request, res: Response) {
  const where: Record<string, unknown> = { ...vendorScopeWhere(req) };
  if (req.query.eventId) where.eventId = req.query.eventId;

  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

  const [items, total] = await Promise.all([
    Recording.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Recording.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

async function getRecording(req: Request, res: Response) {
  const recording = await Recording.findById(req.params.id).lean();
  if (!recording) throw ApiError.notFound();
  assertOwnsVendorRecord(req, recording.vendorId);
  return ok(res, serialize(recording as Record<string, unknown>));
}

async function getEventRecording(req: Request, res: Response) {
  const event = await Event.findById(req.params.id).lean();
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const recording = await Recording.findOne({ eventId: event._id }).sort({ createdAt: -1 }).lean();
  if (!recording) throw ApiError.notFound("No recording for this event");
  return ok(res, serialize(recording as Record<string, unknown>));
}

async function deleteRecording(req: Request, res: Response) {
  const recording = await Recording.findById(req.params.id);
  if (!recording) throw ApiError.notFound();

  await Recording.deleteOne({ _id: recording._id });
  await writeAuditLog(req, { action: "DELETE", module: "recordings", entityId: recording._id, oldData: recording.toJSON() });
  return ok(res, { id: recording._id });
}

const router = Router();
router.use(authenticate, attachTenantScope);

const canRead = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR);
const adminOnly = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN);

router.get("/", canRead, listRecordings);
router.get("/:id", canRead, getRecording);
router.delete("/:id", adminOnly, deleteRecording);

export { getEventRecording };
export default router;
