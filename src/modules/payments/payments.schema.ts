import { z } from "zod";

export const createPaymentSchema = z.object({
  eventId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  gateway: z.string().default("razorpay"),
});
