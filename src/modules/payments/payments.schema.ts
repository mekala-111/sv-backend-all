import { z } from "zod";

export const createPaymentSchema = z.object({
  eventId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  gateway: z.string().default("qr_manual"),
});

export const submitEventCreationPaymentSchema = z.object({
  eventId: z.string().uuid(),
  utrNumber: z
    .string()
    .trim()
    .min(6, "UTR / transaction ID is required")
    .max(64),
  paymentImage: z
    .string()
    .refine(
      (v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v),
      "paymentImage must be an image URL or data URL"
    ),
});

export const rejectEventCreationPaymentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const adminCreditVendorWalletSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});
