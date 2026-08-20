import { z } from "zod";

export const createThemeSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid().optional(),
  previewImage: z.string().url().optional(),
  config: z.record(z.any()),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional(),
});

export const updateThemeSchema = createThemeSchema.partial();

export const assignVendorSchema = z.object({
  vendorId: z.string().uuid(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const createThemeCategorySchema = z.object({
  name: z.string().min(2),
});
