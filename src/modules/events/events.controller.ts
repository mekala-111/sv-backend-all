import { Request, Response } from "express";
import { EventStatus, UserRole, EventAccessType } from "../../types/enums";
import {
  Event,
  EventAccess,
  EventThemeConfig,
  EventMedia,
  YoutubeStream,
  Vendor,
  Theme,
  Customer,
  Payment,
} from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { generateUniqueEventSlug, generateCode, buildPublicEventUrl } from "../../utils/slug";
import { vendorScopeWhere, assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { writeAuditLog } from "../../middleware/auditLog";
import { env } from "../../config/env";
import { hashPassword } from "../../utils/password";
import { createNotification } from "../notifications/notifications.service";
import { serialize, serializeMany } from "../../utils/serialize";

export async function createEvent(req: Request, res: Response) {
  let vendorId = req.auth!.role === UserRole.VENDOR ? req.auth!.vendorId! : req.body.vendorId;
  let customerId = req.body.customerId ?? null;

  if (req.auth!.role === UserRole.CUSTOMER) {
    const customer = await Customer.findById(req.auth!.customerId);
    if (!customer) throw ApiError.forbidden("No customer profile linked");
    vendorId = customer.vendorId;
    customerId = customer._id;
  }

  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw ApiError.badRequest("Vendor not found");

  // Draft is created during the wizard; fee is collected via Razorpay before publish.
  const eventSlug = await generateUniqueEventSlug(req.body.eventName);
  const { eventCreationPaymentId: _feePay, ...eventBody } = req.body;

  const event = await Event.create({
    ...eventBody,
    vendorId,
    customerId,
    eventCode: generateCode("EVT"),
    eventSlug,
    status: EventStatus.DRAFT,
    isPublished: false,
  });

  // Every event gets a default public access row so the public API has a row to read.
  await EventAccess.create({ eventId: event._id, accessType: EventAccessType.PUBLIC, isEnabled: true });

  await writeAuditLog(req, { action: "CREATE", module: "events", entityId: event._id, newData: event.toJSON() });
  return created(res, { ...event.toJSON(), publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug) });
}

export async function listEvents(req: Request, res: Response) {
  const where: Record<string, unknown> = { ...vendorScopeWhere(req) };
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  if (req.query.status) where.status = req.query.status;
  if (req.query.customerId) where.customerId = req.query.customerId;

  const [items, total] = await Promise.all([
    Event.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Event.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function getEvent(req: Request, res: Response) {
  const event = await Event.findById(req.params.id).lean();
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const [themeConfig, media, access, youtubeStreams] = await Promise.all([
    EventThemeConfig.findOne({ eventId: event._id }).lean(),
    EventMedia.find({ eventId: event._id }).sort({ sortOrder: 1 }).lean(),
    EventAccess.findOne({ eventId: event._id }).lean(),
    YoutubeStream.find({ eventId: event._id }).sort({ createdAt: -1 }).lean(),
  ]);

  return ok(res, {
    ...serialize(event as Record<string, unknown>),
    themeConfig: serialize(themeConfig as Record<string, unknown> | null),
    media: serializeMany(media as Record<string, unknown>[]),
    access: serialize(access as Record<string, unknown> | null),
    youtubeStreams: serializeMany(youtubeStreams as Record<string, unknown>[]),
  });
}

export async function updateEvent(req: Request, res: Response) {
  const existing = await Event.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  const data = { ...req.body };

  if (data.eventSlug !== undefined) {
    if (existing.isPublished) {
      throw ApiError.badRequest("Public slug cannot be changed after the event is published");
    }
    const slug = String(data.eventSlug)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length < 2) throw ApiError.badRequest("Invalid event slug");
    const clash = await Event.findOne({ eventSlug: slug, _id: { $ne: existing._id } }).lean();
    if (clash) throw ApiError.conflict("This event slug is already in use");
    data.eventSlug = slug;
  }

  const oldData = existing.toJSON();
  Object.assign(existing, data);
  await existing.save();
  await writeAuditLog(req, { action: "UPDATE", module: "events", entityId: existing._id, oldData, newData: data });
  return ok(res, {
    ...existing.toJSON(),
    publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, existing.eventSlug),
  });
}

export async function deleteEvent(req: Request, res: Response) {
  const existing = await Event.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  // Unpaid / unpublished drafts are removed entirely so a failed payment leaves no event.
  if (!existing.isPublished && existing.status === EventStatus.DRAFT) {
    const eventId = existing._id;
    await Promise.all([
      EventAccess.deleteMany({ eventId }),
      EventThemeConfig.deleteMany({ eventId }),
      EventMedia.deleteMany({ eventId }),
      YoutubeStream.deleteMany({ eventId }),
      Payment.updateMany({ eventId }, { $set: { eventId: null } }),
      Event.deleteOne({ _id: eventId }),
    ]);
    await writeAuditLog(req, { action: "DELETE", module: "events", entityId: eventId, oldData: existing.toJSON() });
    return ok(res, { id: eventId, status: "DELETED" });
  }

  existing.status = EventStatus.CANCELLED;
  await existing.save();
  await writeAuditLog(req, { action: "DELETE", module: "events", entityId: req.params.id, oldData: existing.toJSON() });
  return ok(res, { id: req.params.id, status: "CANCELLED" });
}

export async function publishEvent(req: Request, res: Response) {
  const existing = await Event.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  if (existing.isPublished) {
    return ok(res, {
      ...existing.toJSON(),
      publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, existing.eventSlug),
    });
  }

  const vendor = await Vendor.findById(existing.vendorId);
  if (!vendor) throw ApiError.badRequest("Vendor not found");
  const fee = Number(vendor.eventCreationFee ?? 0);

  if (req.auth!.role === UserRole.VENDOR && fee > 0) {
    const { Payment } = await import("../../models");
    const { PaymentStatus } = await import("../../types/enums");
    const paymentId = req.body.eventCreationPaymentId as string | undefined;
    const payment = paymentId
      ? await Payment.findById(paymentId)
      : await Payment.findOne({
          eventId: existing._id,
          purpose: "EVENT_CREATION",
          status: PaymentStatus.SUCCESS,
        });
    if (
      !payment ||
      payment.vendorId !== existing.vendorId ||
      payment.purpose !== "EVENT_CREATION" ||
      payment.status !== PaymentStatus.SUCCESS
    ) {
      throw ApiError.badRequest("Payment required before publishing. Complete Razorpay payment first.");
    }
    if (payment.eventId && payment.eventId !== existing._id) {
      throw ApiError.badRequest("This payment was already used for another event");
    }
    if (!payment.eventId) {
      payment.eventId = existing._id;
      await payment.save();
    }
  }

  existing.isPublished = true;
  existing.publishedAt = new Date();
  if (existing.status === EventStatus.DRAFT) existing.status = EventStatus.UPCOMING;
  await existing.save();

  await writeAuditLog(req, { action: "PUBLISH", module: "events", entityId: existing._id });

  if (vendor) {
    await createNotification(
      vendor.userId,
      "EVENT_PUBLISHED",
      "Event published",
      `"${existing.eventName}" is now live at ${buildPublicEventUrl(env.publicEventBaseUrl, existing.eventSlug)}`
    );
  }

  return ok(res, { ...existing.toJSON(), publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, existing.eventSlug) });
}

export async function unpublishEvent(req: Request, res: Response) {
  const existing = await Event.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  assertOwnsVendorRecord(req, existing.vendorId);

  existing.isPublished = false;
  await existing.save();
  await writeAuditLog(req, { action: "UNPUBLISH", module: "events", entityId: existing._id });
  return ok(res, existing.toJSON());
}

/** Lets a vendor/customer preview exactly what the public page will render, even while unpublished. */
export async function previewEvent(req: Request, res: Response) {
  const event = await Event.findById(req.params.id).lean();
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const [theme, themeConfig, media, youtubeStreams, vendor] = await Promise.all([
    event.themeId ? Theme.findById(event.themeId).lean() : null,
    EventThemeConfig.findOne({ eventId: event._id }).lean(),
    EventMedia.find({ eventId: event._id }).sort({ sortOrder: 1 }).lean(),
    YoutubeStream.find({ eventId: event._id }).sort({ createdAt: -1 }).lean(),
    Vendor.findById(event.vendorId).select("companyName whatsappNumber whatsappEnabled").lean(),
  ]);

  return ok(res, {
    ...serialize(event as Record<string, unknown>),
    theme: serialize(theme as Record<string, unknown> | null),
    themeConfig: serialize(themeConfig as Record<string, unknown> | null),
    media: serializeMany(media as Record<string, unknown>[]),
    youtubeStreams: serializeMany(youtubeStreams as Record<string, unknown>[]),
    vendor: vendor
      ? { companyName: vendor.companyName, whatsappNumber: vendor.whatsappNumber, whatsappEnabled: vendor.whatsappEnabled }
      : null,
  });
}

export async function setEventThemeConfig(req: Request, res: Response) {
  const event = await Event.findById(req.params.id);
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const config = await EventThemeConfig.findOneAndUpdate(
    { eventId: event._id },
    { $set: { ...req.body, eventId: event._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  event.themeId = req.body.themeId;
  await event.save();

  await writeAuditLog(req, { action: "UPDATE", module: "event_theme_config", entityId: event._id, newData: req.body });
  return ok(res, config.toJSON());
}

export async function setEventAccess(req: Request, res: Response) {
  const event = await Event.findById(req.params.id);
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const { accessType, password, isEnabled } = req.body;
  if (accessType === "PRIVATE" && !password) {
    throw ApiError.badRequest("password is required when accessType is PRIVATE");
  }

  const passwordHash = password ? await hashPassword(password) : undefined;
  const update: Record<string, unknown> = {
    accessType,
    eventId: event._id,
  };
  if (isEnabled !== undefined) update.isEnabled = isEnabled;
  if (passwordHash !== undefined) update.passwordHash = passwordHash;

  const access = await EventAccess.findOneAndUpdate(
    { eventId: event._id },
    {
      $set: update,
      $setOnInsert: { isEnabled: isEnabled ?? true },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await writeAuditLog(req, {
    action: "UPDATE",
    module: "event_access",
    entityId: event._id,
    newData: { accessType, isEnabled },
  });

  const json = access.toJSON() as Record<string, unknown>;
  delete json.passwordHash;
  return ok(res, json);
}
