import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});
