import { z } from "zod";

export const createEventSchema = z.object({
  customerId: z.string().uuid().optional(),
  eventName: z.string().min(2),
  eventType: z.string().optional(),
  description: z.string().optional(),
  eventDate: z.coerce.date().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  coverImage: z.string().url().optional(),
  pageTitle: z.string().optional(),
  liveTiming: z.string().optional(),
  themeId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(["DRAFT", "UPCOMING", "LIVE", "COMPLETED", "CANCELLED", "EXPIRED"]).optional(),
});

export const setEventAccessSchema = z.object({
  accessType: z.enum(["PUBLIC", "PRIVATE"]),
  password: z.string().min(4).optional(), // required when accessType === PRIVATE
  isEnabled: z.boolean().optional(),
});

export const setEventThemeConfigSchema = z.object({
  themeId: z.string().uuid(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  logo: z.string().url().optional(),
  coverImage: z.string().url().optional(),
  pageTitle: z.string().optional(),
  description: z.string().optional(),
  liveTiming: z.string().optional(),
  customConfig: z.record(z.any()).optional(),
});
