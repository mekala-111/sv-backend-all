import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { vendorScopeWhere } from "../../middleware/tenantScope";
import { env } from "../../config/env";
import { creditWallet } from "../wallet/wallet.service";
import { createNotification } from "../notifications/notifications.service";

export async function listPayments(req: Request, res: Response) {
  const where: any = vendorScopeWhere(req);
  if (req.query.customerId) where.customerId = req.query.customerId;
  const payments = await prisma.payment.findMany({ where, orderBy: { createdAt: "desc" } });
  return ok(res, payments);
}

/** Creates a PENDING payment row. Actual gateway order creation (Razorpay order_id) happens client-side or here if you prefer server-driven order creation. */
export async function createPayment(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId ?? req.body.vendorId ?? null;
  const payment = await prisma.payment.create({
    data: { ...req.body, vendorId, status: "PENDING" },
  });
  return created(res, payment);
}

/**
 * Razorpay webhook handler. Verifies the HMAC signature against RAZORPAY_KEY_SECRET
 * before trusting the payload — never trust gateway_transaction_id from the client directly.
 */
export async function razorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (!signature || !env.razorpay.keySecret) throw ApiError.unauthorized("Invalid webhook signature");

  const expected = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (expected !== signature) throw ApiError.unauthorized("Signature mismatch");

  const event = req.body.event; // e.g. "payment.captured"
  const entity = req.body.payload?.payment?.entity;
  if (!entity) return ok(res, { received: true });

  const payment = await prisma.payment.findFirst({ where: { gatewayTransactionId: entity.order_id } });
  if (!payment) return ok(res, { received: true });

  if (event === "payment.captured") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", paidAt: new Date(), gatewayTransactionId: entity.id },
    });
    if (payment.vendorId) {
      await creditWallet(payment.vendorId, Number(payment.amount), "payment", payment.id, "Payment received");
      const vendor = await prisma.vendor.findUnique({ where: { id: payment.vendorId } });
      if (vendor) await createNotification(vendor.userId, "PAYMENT_SUCCESSFUL", "Payment received", `₹${payment.amount} payment succeeded`);
    }
  } else if (event === "payment.failed") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  }

  return ok(res, { received: true });
}
