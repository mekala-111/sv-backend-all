import { Router, Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { ApiError, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";

async function listMyNotifications(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const unreadOnly = req.query.unreadOnly === "true";

  const where = { userId: req.auth!.userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.auth!.userId, isRead: false } }),
  ]);

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount });
}

async function markRead(req: Request, res: Response) {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.auth!.userId) throw ApiError.notFound();

  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  return ok(res, updated);
}

async function markAllRead(req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { userId: req.auth!.userId, isRead: false }, data: { isRead: true } });
  return ok(res, { updated: true });
}

const router = Router();
router.use(authenticate);

router.get("/", listMyNotifications);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);

export default router;
