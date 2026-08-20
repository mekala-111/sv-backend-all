import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(2), // owner user's name
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  companyName: z.string().min(2),
  logo: z.string().url().optional(),
  address: z.string().optional(),
  planId: z.string().optional(),
  whatsappNumber: z.string().optional(),
});

export const updateVendorSchema = z.object({
  companyName: z.string().min(2).optional(),
  logo: z.string().url().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL"]).optional(),
  planId: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappEnabled: z.boolean().optional(),
});
