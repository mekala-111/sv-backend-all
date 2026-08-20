import { z } from "zod";

export const addMediaSchema = z.object({
  type: z.enum(["COVER", "GALLERY", "TEASER", "CUSTOM", "LOGO", "WHATSAPP"]),
  fileUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
});

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});
