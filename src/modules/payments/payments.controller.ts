import { Request, Response } from "express";
import crypto from "crypto";
import { PaymentStatus, UserRole, EventStatus } from "../../types/enums";
import { Payment, Vendor, Event, Setting } from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { vendorScopeWhere, assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { env } from "../../config/env";
import { creditWallet, creditPlatform, getPlatformWallet } from "../wallet/wallet.service";
import { createNotification } from "../notifications/notifications.service";
import { serialize, serializeMany } from "../../utils/serialize";
import { buildPublicEventUrl } from "../../utils/slug";
import { writeAuditLog } from "../../middleware/auditLog";

const PAYMENT_QR_KEY = "payment.qrImage";
const PAYMENT_NAME_KEY = "payment.payeeName";
const PAYMENT_NOTE_KEY = "payment.instructions";

export async function listPayments(req: Request, res: Response) {
  const where: Record<string, unknown> = { ...vendorScopeWhere(req) };
  if (req.query.customerId) where.customerId = req.query.customerId;
  if (req.query.eventId) where.eventId = req.query.eventId;
  if (req.query.purpose) where.purpose = req.query.purpose;
  if (req.query.status) where.status = req.query.status;
  const payments = await Payment.find(where).sort({ createdAt: -1 }).lean();
  return ok(res, serializeMany(payments as Record<string, unknown>[]));
}

export async function createPayment(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId ?? req.body.vendorId ?? null;
  const payment = await Payment.create({
    ...req.body,
    vendorId,
    purpose: req.body.purpose ?? "CUSTOMER",
    status: PaymentStatus.PENDING,
  });
  return created(res, payment.toJSON());
}

/** QR + payee name for vendors paying the event creation fee. */
export async function getEventCreationPaymentConfig(req: Request, res: Response) {
  if (req.auth!.role !== UserRole.VENDOR || !req.auth!.vendorId) {
    throw ApiError.forbidden();
  }
  const vendor = await Vendor.findById(req.auth!.vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const [qr, name, note] = await Promise.all([
    Setting.findById(PAYMENT_QR_KEY).lean(),
    Setting.findById(PAYMENT_NAME_KEY).lean(),
    Setting.findById(PAYMENT_NOTE_KEY).lean(),
  ]);

  const fee = Number(vendor.eventCreationFee ?? 0);
  return ok(res, {
    amount: fee,
    currency: "INR",
    free: fee <= 0,
    payeeName: (name as { value?: unknown } | null)?.value ?? "",
    qrImage: (qr as { value?: unknown } | null)?.value ?? "",
    instructions:
      (note as { value?: unknown } | null)?.value ??
      "Scan the QR, pay the fee, then enter your UTR / transaction ID and upload the payment screenshot.",
  });
}

/**
 * Vendor submits UTR + payment screenshot. Payment stays PENDING until admin approves.
 * Event is not published until approval.
 */
export async function submitEventCreationPayment(req: Request, res: Response) {
  if (req.auth!.role !== UserRole.VENDOR || !req.auth!.vendorId) {
    throw ApiError.forbidden("Only vendors can submit event creation payments");
  }
  const vendorId = req.auth!.vendorId;
  const { eventId, utrNumber, paymentImage } = req.body as {
    eventId: string;
    utrNumber: string;
    paymentImage: string;
  };

  const event = await Event.findById(eventId);
  if (!event) throw ApiError.notFound("Event not found");
  assertOwnsVendorRecord(req, event.vendorId);
  if (event.isPublished) throw ApiError.badRequest("Event is already published");

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");
  const fee = Number(vendor.eventCreationFee ?? 0);

  if (fee <= 0) {
    event.isPublished = true;
    event.publishedAt = new Date();
    if (event.status === EventStatus.DRAFT) event.status = EventStatus.UPCOMING;
    await event.save();
    await writeAuditLog(req, { action: "PUBLISH", module: "events", entityId: event._id });
    return ok(res, {
      free: true,
      paid: true,
      published: true,
      paymentId: null,
      publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug),
      event: event.toJSON(),
    });
  }

  const utr = String(utrNumber).trim().toUpperCase();
  const existingUtr = await Payment.findOne({
    purpose: "EVENT_CREATION",
    $or: [{ utrNumber: utr }, { gatewayTransactionId: utr }],
    status: { $in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
  });
  if (existingUtr && existingUtr.eventId !== eventId) {
    throw ApiError.conflict("This UTR / transaction ID was already used");
  }

  let payment = await Payment.findOne({
    eventId,
    purpose: "EVENT_CREATION",
    vendorId,
    status: PaymentStatus.PENDING,
  });

  if (payment) {
    payment.utrNumber = utr;
    payment.gatewayTransactionId = utr;
    payment.paymentImage = paymentImage;
    payment.amount = fee;
    payment.gateway = "qr_manual";
    payment.rejectionReason = null;
    await payment.save();
  } else {
    payment = await Payment.create({
      vendorId,
      eventId,
      amount: fee,
      currency: "INR",
      gateway: "qr_manual",
      gatewayTransactionId: utr,
      utrNumber: utr,
      paymentImage,
      status: PaymentStatus.PENDING,
      purpose: "EVENT_CREATION",
    });
  }

    await createNotification(
      vendor.userId,
      "PAYMENT_SUCCESSFUL",
      "Payment submitted for review",
      `UTR ${utr} submitted for "${event.eventName}". Waiting for admin approval.`
    );

  return created(res, {
    free: false,
    paid: false,
    pending: true,
    published: false,
    paymentId: payment._id,
    payment: payment.toJSON(),
    message: "Payment submitted. Admin will review and approve to make the event live.",
  });
}

/** Admin approves QR payment → credit platform wallet + publish event. */
export async function approveEventCreationPayment(req: Request, res: Response) {
  if (req.auth!.role !== UserRole.SUPER_ADMIN && req.auth!.role !== UserRole.ADMIN) {
    throw ApiError.forbidden();
  }
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.purpose !== "EVENT_CREATION") {
    throw ApiError.badRequest("Not an event creation payment");
  }
  if (payment.status === PaymentStatus.SUCCESS) {
    return ok(res, { payment: payment.toJSON(), alreadyApproved: true });
  }
  if (payment.status !== PaymentStatus.PENDING) {
    throw ApiError.badRequest(`Cannot approve payment in status ${payment.status}`);
  }
  if (!payment.eventId) throw ApiError.badRequest("Payment is not linked to an event");

  const event = await Event.findById(payment.eventId);
  if (!event) throw ApiError.notFound("Event not found");

  payment.status = PaymentStatus.SUCCESS;
  payment.paidAt = new Date();
  payment.reviewedAt = new Date();
  payment.reviewedBy = req.auth!.userId;
  payment.rejectionReason = null;
  await payment.save();

  await creditPlatform(Number(payment.amount), {
    vendorId: payment.vendorId ?? undefined,
    referenceType: "event_creation_fee",
    referenceId: payment._id,
    description: `Event creation fee UTR ${payment.utrNumber || payment.gatewayTransactionId}`,
  });

  event.isPublished = true;
  event.publishedAt = new Date();
  if (event.status === EventStatus.DRAFT || event.status === EventStatus.CANCELLED) {
    event.status = EventStatus.UPCOMING;
  }
  await event.save();

  const vendor = payment.vendorId ? await Vendor.findById(payment.vendorId) : null;
  if (vendor) {
    await createNotification(
      vendor.userId,
      "PAYMENT_SUCCESSFUL",
      "Payment approved — event is live",
      `"${event.eventName}" is live at ${buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug)}`
    );
  }

  await writeAuditLog(req, {
    action: "APPROVE",
    module: "payments",
    entityId: payment._id,
    newData: { status: PaymentStatus.SUCCESS, eventId: event._id },
  });

  return ok(res, {
    payment: payment.toJSON(),
    event: event.toJSON(),
    publicUrl: buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug),
  });
}

/** Admin rejects QR payment → mark failed and cancel the draft event. */
export async function rejectEventCreationPayment(req: Request, res: Response) {
  if (req.auth!.role !== UserRole.SUPER_ADMIN && req.auth!.role !== UserRole.ADMIN) {
    throw ApiError.forbidden();
  }
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.purpose !== "EVENT_CREATION") {
    throw ApiError.badRequest("Not an event creation payment");
  }
  if (payment.status !== PaymentStatus.PENDING) {
    throw ApiError.badRequest(`Cannot reject payment in status ${payment.status}`);
  }

  const reason = String(req.body.reason ?? "Payment rejected by admin").trim();
  payment.status = PaymentStatus.FAILED;
  payment.reviewedAt = new Date();
  payment.reviewedBy = req.auth!.userId;
  payment.rejectionReason = reason;
  await payment.save();

  let eventJson = null;
  if (payment.eventId) {
    const event = await Event.findById(payment.eventId);
    if (event && !event.isPublished) {
      event.status = EventStatus.CANCELLED;
      event.isPublished = false;
      await event.save();
      eventJson = event.toJSON();
    }
  }

  const vendor = payment.vendorId ? await Vendor.findById(payment.vendorId) : null;
  if (vendor) {
    await createNotification(
      vendor.userId,
      "PAYMENT_FAILED",
      "Payment rejected",
      reason
    );
  }

  await writeAuditLog(req, {
    action: "REJECT",
    module: "payments",
    entityId: payment._id,
    newData: { status: PaymentStatus.FAILED, reason },
  });

  return ok(res, { payment: payment.toJSON(), event: eventJson });
}

export async function getPlatformRevenue(req: Request, res: Response) {
  if (req.auth!.role !== UserRole.SUPER_ADMIN && req.auth!.role !== UserRole.ADMIN) {
    throw ApiError.forbidden();
  }
  const wallet = await getPlatformWallet();
  const fees = await Payment.find({ purpose: "EVENT_CREATION" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return ok(res, {
    balance: wallet.balance,
    currency: wallet.currency,
    recentFees: serializeMany(fees as Record<string, unknown>[]),
  });
}

export async function adminCreditVendorWallet(req: Request, res: Response) {
  if (req.auth!.role !== UserRole.SUPER_ADMIN && req.auth!.role !== UserRole.ADMIN) {
    throw ApiError.forbidden();
  }
  const vendorId = req.params.vendorId;
  const amount = Number(req.body.amount);
  const description = String(req.body.description ?? "Admin wallet top-up");
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw ApiError.notFound();
  const wallet = await creditWallet(vendorId, amount, "admin_topup", req.auth!.userId, description);
  return ok(res, wallet.toJSON());
}

/** Legacy webhook kept for compatibility; QR flow does not use it. */
export async function razorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (!signature || !env.razorpay.keySecret) throw ApiError.unauthorized("Invalid webhook signature");

  const expected = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (expected !== signature) throw ApiError.unauthorized("Signature mismatch");
  return ok(res, { received: true });
}
