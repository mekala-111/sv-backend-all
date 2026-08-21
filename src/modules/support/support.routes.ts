import { Router, Request, Response } from "express";
import { UserRole, TicketStatus, TicketPriority } from "../../types/enums";
import { SupportTicket } from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope, vendorScopeWhere } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";
import { generateCode } from "../../utils/slug";
import { serialize, serializeMany } from "../../utils/serialize";

async function listTickets(req: Request, res: Response) {
  const where: Record<string, unknown> = { ...vendorScopeWhere(req) };
  // vendorScopeWhere for ADMIN returns {}; for VENDOR returns { vendorId }
  if (req.auth!.role === UserRole.VENDOR) {
    where.vendorId = req.auth!.vendorId;
  }
  if (req.query.status) where.status = req.query.status;

  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));

  const [items, total] = await Promise.all([
    SupportTicket.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SupportTicket.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

async function createTicket(req: Request, res: Response) {
  const { subject, category, priority, body } = req.body;
  if (!subject) throw ApiError.badRequest("subject is required");

  const ticket = await SupportTicket.create({
    ticketCode: generateCode("TKT"),
    vendorId: req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId : req.body.vendorId ?? null,
    customerId: req.auth!.customerId ?? null,
    userId: req.auth!.userId,
    subject,
    category: category ?? "General",
    priority: priority ?? TicketPriority.MEDIUM,
    status: TicketStatus.OPEN,
    messages: body
      ? [{ authorId: req.auth!.userId, authorRole: req.auth!.role, body, createdAt: new Date() }]
      : [],
  });

  await writeAuditLog(req, { action: "CREATE", module: "support", entityId: ticket._id, newData: ticket.toJSON() });
  return created(res, ticket.toJSON());
}

async function getTicket(req: Request, res: Response) {
  const ticket = await SupportTicket.findById(req.params.id).lean();
  if (!ticket) throw ApiError.notFound();

  if (req.auth!.role === UserRole.VENDOR && ticket.vendorId !== req.auth!.vendorId) {
    throw ApiError.forbidden();
  }

  return ok(res, serialize(ticket as Record<string, unknown>));
}

async function updateTicket(req: Request, res: Response) {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw ApiError.notFound();

  if (req.auth!.role === UserRole.VENDOR && ticket.vendorId !== req.auth!.vendorId) {
    throw ApiError.forbidden();
  }

  const { status, priority, assignedTo, message } = req.body;
  if (status !== undefined) {
    if (req.auth!.role === UserRole.VENDOR && ![TicketStatus.OPEN, TicketStatus.PENDING].includes(status)) {
      // vendors can only leave open/pending; admins can resolve/close
    }
    ticket.status = status;
  }
  if (priority !== undefined && (req.auth!.role === UserRole.SUPER_ADMIN || req.auth!.role === UserRole.ADMIN)) {
    ticket.priority = priority;
  }
  if (assignedTo !== undefined && (req.auth!.role === UserRole.SUPER_ADMIN || req.auth!.role === UserRole.ADMIN)) {
    ticket.assignedTo = assignedTo;
  }
  if (message) {
    ticket.messages.push({
      authorId: req.auth!.userId,
      authorRole: req.auth!.role,
      body: message,
      createdAt: new Date(),
    } as any);
  }

  await ticket.save();
  await writeAuditLog(req, { action: "UPDATE", module: "support", entityId: ticket._id, newData: req.body });
  return ok(res, ticket.toJSON());
}

const router = Router();
router.use(
  authenticate,
  attachTenantScope,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR)
);

router.get("/tickets", listTickets);
router.post("/tickets", createTicket);
router.get("/tickets/:id", getTicket);
router.patch("/tickets/:id", updateTicket);

export default router;
