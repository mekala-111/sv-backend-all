import { z } from "zod";

/** Treat blank strings as omitted so optional UUID fields are not required. */
const optionalUuid = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().uuid().optional()
);

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);

const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional()
);

/** Cover images may be http(s) URLs or local data: URLs before S3 is wired. */
const optionalCoverImage = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .refine(
      (v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v),
      "coverImage must be an image URL or data URL"
    )
    .optional()
);

const optionalImageRef = optionalCoverImage;

const optionalImageList = z.preprocess(
  (v) => {
    if (v == null || v === "") return undefined;
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  },
  z
    .array(
      z.string().refine(
        (s) => /^https?:\/\//i.test(s) || /^data:image\//i.test(s),
        "gallery image must be URL or data URL"
      )
    )
    .max(20)
    .optional()
);

const optionalSubEvents = z.preprocess(
  (v) => {
    if (v == null || v === "") return undefined;
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  },
  z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        date: z.string().max(80).optional().nullable(),
        time: z.string().max(80).optional().nullable(),
        place: z.string().max(200).optional().nullable(),
        image: optionalImageRef,
      })
    )
    .max(20)
    .optional()
);

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.date().optional()
);

export const createEventSchema = z.object({
  // Only actually used when the caller is SUPER_ADMIN/ADMIN (vendors/customers get their own
  // vendorId from the auth token) — declared here so validateBody's schema.parse() doesn't
  // strip it before the controller reads req.body.vendorId.
  vendorId: optionalUuid,
  customerId: optionalUuid,
  eventName: z.string().min(2),
  eventType: optionalString,
  description: optionalString,
  eventDate: optionalDate,
  startTime: optionalDate,
  endTime: optionalDate,
  timezone: optionalString,
  location: optionalString,
  googleMapsUrl: optionalUrl,
  coverImage: optionalCoverImage,
  pageTitle: optionalString,
  metaTitle: optionalString,
  metaDescription: optionalString,
  liveTiming: optionalString,
  themeId: optionalUuid,
  isPublic: z.boolean().optional(),
  eventCreationPaymentId: optionalUuid,
  teaserUrl: optionalUrl,
  scrollMessage: optionalString,
  galleryImages: optionalImageList,
  brideName: optionalString,
  groomName: optionalString,
  brideImage: optionalImageRef,
  groomImage: optionalImageRef,
  eventTime: optionalString,
  eventPlace: optionalString,
  invitationCard: optionalImageRef,
  subEvents: optionalSubEvents,
  logoImage: optionalImageRef,
  customImage: optionalImageRef,
  whatsappImage: optionalImageRef,
  showWatchLive: z.boolean().optional(),
  showSocialShare: z.boolean().optional(),
  remarks1: optionalString,
  remarks2: optionalString,
  fontFamily: optionalString,
  fontColor: optionalString,
  accessPin: optionalString,
  whatsappNumber: optionalString,
  whatsappEnabled: z.boolean().optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(["DRAFT", "UPCOMING", "LIVE", "COMPLETED", "CANCELLED", "EXPIRED"]).optional(),
  eventSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens")
    .optional(),
  youtubeChannelId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid().nullable().optional()
  ),
  youtubeVideoId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().nullable().optional()
  ),
  youtubeLiveUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().nullable().optional()
  ),
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
  logo: z
    .string()
    .refine((v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v))
    .optional(),
  coverImage: z
    .string()
    .refine((v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v))
    .optional(),
  pageTitle: z.string().optional(),
  description: z.string().optional(),
  liveTiming: z.string().optional(),
  customConfig: z.record(z.any()).optional(),
});
