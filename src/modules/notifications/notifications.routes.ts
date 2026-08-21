import { Router, Request, Response } from "express";
import { Notification } from "../../models";
import { ApiError, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { serializeMany } from "../../utils/serialize";

async function listMyNotifications(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const unreadOnly = req.query.unreadOnly === "true";

  const where = { userId: req.auth!.userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(where),
    Notification.countDocuments({ userId: req.auth!.userId, isRead: false }),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    unreadCount,
  });
}

async function markRead(req: Request, res: Response) {
  const notification = await Notification.findById(req.params.id);
  if (!notification || notification.userId !== req.auth!.userId) throw ApiError.notFound();

  notification.isRead = true;
  await notification.save();
  return ok(res, notification.toJSON());
}

async function markAllRead(req: Request, res: Response) {
  await Notification.updateMany({ userId: req.auth!.userId, isRead: false }, { isRead: true });
  return ok(res, { updated: true });
}

const router = Router();
router.use(authenticate);

router.get("/", listMyNotifications);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);

export default router;
