import { Request, Response } from "express";
import { EventStatus, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { generateUniqueEventSlug, generateCode, buildPublicEventUrl } from "../../utils/slug";
import { vendorScopeWhere, assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";
import { env } from "../../config/env";
import { hashPassword } from "../../utils/password";
import { createNotification } from "../notifications/notifications.service";

export async function createEvent(req: Request, res: Response) {
  const vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : req.body.vendorId;
  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const eventSlug = await generateUniqueEventSlug(req.body.eventName);

  const event = await prisma.event.create({
    data: {
      ...req.body,
      vendorId,
      eventCode: generateCode("EVT"),
      eventSlug,
      status: EventStatus.DRAFT,
    },
  });

  // Every event gets a default public access row so the public API has a row to read.
  await prisma.eventAccess.create({ data: { eventId: event.id, accessType: "PUBLIC", isEnabled: true } });

  await writeAuditLog(req, { action: "CREATE", module: "events", entityId: event.id, newData: event });
  return created(res, { ...event, publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug) });
}

export async function listEvents(req: Request, res: Response) {
  const where: any = { ...vendorScopeWhere(req) };
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  if (req.query.status) where.status = req.query.status;
  if (req.query.customerId) where.customerId = req.query.customerId;

  const [items, total] = await Promise.all([
    prisma.event.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.event.count({ where }),
  ]);

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function getEvent(req: Request, res: Response) {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { themeConfig: true, media: true, access: true, youtubeStreams: true },
  });
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);
  return ok(res, event);
}

export async function updateEvent(req: Request, res: Response) {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  const data = { ...req.body };
  // Renaming the event does NOT change the slug automatically — the public link must stay stable
  // once shared. Slug changes must go through a dedicated endpoint if ever needed.
  delete data.eventSlug;

  const event = await prisma.event.update({ where: { id: req.params.id }, data });
  await writeAuditLog(req, { action: "UPDATE", module: "events", entityId: event.id, oldData: existing, newData: data });
  return ok(res, event);
}

export async function deleteEvent(req: Request, res: Response) {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  await prisma.event.update({ where: { id: req.params.id }, data: { status: EventStatus.CANCELLED } });
  await writeAuditLog(req, { action: "DELETE", module: "events", entityId: req.params.id, oldData: existing });
  return ok(res, { id: req.params.id, status: "CANCELLED" });
}

export async function publishEvent(req: Request, res: Response) {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { isPublished: true, publishedAt: new Date(), status: existing.status === EventStatus.DRAFT ? EventStatus.UPCOMING : existing.status },
  });

  await writeAuditLog(req, { action: "PUBLISH", module: "events", entityId: event.id });

  const vendor = await prisma.vendor.findUnique({ where: { id: event.vendorId } });
  if (vendor) {
    await createNotification(vendor.userId, "EVENT_PUBLISHED", "Event published", `"${event.eventName}" is now live at ${buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug)}`);
  }

  return ok(res, { ...event, publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug) });
}

export async function unpublishEvent(req: Request, res: Response) {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  const event = await prisma.event.update({ where: { id: req.params.id }, data: { isPublished: false } });
  await writeAuditLog(req, { action: "UNPUBLISH", module: "events", entityId: event.id });
  return ok(res, event);
}

/** Lets a vendor/customer preview exactly what the public page will render, even while unpublished. */
export async function previewEvent(req: Request, res: Response) {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { theme: true, themeConfig: true, media: true, youtubeStreams: true, vendor: { select: { companyName: true, whatsappNumber: true, whatsappEnabled: true } } },
  });
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);
  return ok(res, event);
}

export async function setEventThemeConfig(req: Request, res: Response) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const config = await prisma.eventThemeConfig.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, ...req.body },
    update: { ...req.body },
  });
  await prisma.event.update({ where: { id: event.id }, data: { themeId: req.body.themeId } });

  await writeAuditLog(req, { action: "UPDATE", module: "event_theme_config", entityId: event.id, newData: req.body });
  return ok(res, config);
}

export async function setEventAccess(req: Request, res: Response) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const { accessType, password, isEnabled } = req.body;
  if (accessType === "PRIVATE" && !password) {
    throw ApiError.badRequest("password is required when accessType is PRIVATE");
  }

  const access = await prisma.eventAccess.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      accessType,
      isEnabled: isEnabled ?? true,
      passwordHash: password ? await hashPassword(password) : null,
    },
    update: {
      accessType,
      ...(isEnabled !== undefined ? { isEnabled } : {}),
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  await writeAuditLog(req, { action: "UPDATE", module: "event_access", entityId: event.id, newData: { accessType, isEnabled } });
  return ok(res, { ...access, passwordHash: undefined });
}
