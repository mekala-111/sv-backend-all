import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
  vendorId: z.string().uuid(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  newPassword: z.string().min(8),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  purpose: z.enum(["PHONE_VERIFY", "EMAIL_VERIFY", "LOGIN"]),
});
