import { Router, Request, Response } from "express";
import QRCode from "qrcode";
import { EventStatus, MediaStatus, EventAccessType, PlanStatus } from "../../types/enums";
import {
  Event,
  EventAccess,
  EventMedia,
  EventThemeConfig,
  YoutubeStream,
  Vendor,
  Theme,
  Booking,
  ContactMessage,
  Plan,
  Setting,
} from "../../models";
import { ApiError, ok, created } from "../../utils/apiResponse";
import { buildPublicEventUrl } from "../../utils/slug";
import { env } from "../../config/env";
import { verifyPassword } from "../../utils/password";
import { serialize, serializeMany } from "../../utils/serialize";
import { verifyEventPreviewToken } from "../../utils/jwt";

async function loadPublicEventBundle(
  slugOrFilter: { eventSlug?: string; eventCode?: string },
  opts: { previewEventId?: string | null } = {}
) {
  const event = await Event.findOne(slugOrFilter).lean();
  if (!event) return null;
  // Unpublished events are visible only through a valid preview link for that exact event.
  const isPreview = !!opts.previewEventId && opts.previewEventId === String(event._id);
  if (!event.isPublished && !isPreview) return null;

  const [theme, themeConfig, media, access, youtubeStreams, vendor] = await Promise.all([
    event.themeId ? Theme.findById(event.themeId).lean() : null,
    EventThemeConfig.findOne({ eventId: event._id }).lean(),
    EventMedia.find({ eventId: event._id, status: MediaStatus.ACTIVE }).sort({ sortOrder: 1 }).lean(),
    EventAccess.findOne({ eventId: event._id }).lean(),
    YoutubeStream.find({ eventId: event._id }).sort({ createdAt: -1 }).limit(1).lean(),
    Vendor.findById(event.vendorId).select("companyName whatsappNumber whatsappEnabled").lean(),
  ]);

  return {
    ...event,
    theme,
    themeConfig,
    media,
    access,
    youtubeStreams,
    vendor,
  };
}

/** Counts one page view without delaying the response; the payload shows the new total. */
function countView(event: { _id?: unknown; viewCount?: number }) {
  event.viewCount = Number(event.viewCount ?? 0) + 1;
  Event.updateOne({ _id: event._id }, { $inc: { viewCount: 1 } }).catch(() => {
    /* a missed count must never break the page */
  });
}

/**
 * GET /api/public/events/:slug
 * Returns { event, theme, branding, youtube, media } — exactly what the
 * public viewer frontend needs to render the event page. No vendor/admin
 * auth required (section 16). Private events return access metadata only,
 * requiring a follow-up password check before real content is exposed.
 */
async function getPublicEvent(req: Request, res: Response) {
  const previewEventId = verifyEventPreviewToken(req.query.previewToken);
  const event = await loadPublicEventBundle({ eventSlug: req.params.slug }, { previewEventId });
  if (!event) throw ApiError.notFound("Event not found");

  // The owner's preview link skips the PIN and isn't counted as a page view.
  if (previewEventId === String(event._id)) {
    return ok(res, buildPublicPayload(event));
  }

  const isPrivate = event.access?.accessType === EventAccessType.PRIVATE && event.access.isEnabled;

  if (isPrivate) {
    // Don't leak event details until the password check passes.
    return ok(res, {
      event: { eventSlug: event.eventSlug, eventName: event.eventName, status: event.status, isPrivate: true },
      requiresPassword: true,
    });
  }

  countView(event);
  return ok(res, buildPublicPayload(event));
}

/** POST /api/public/events/:slug/unlock — verifies a private event's password and returns full payload. */
async function unlockPrivateEvent(req: Request, res: Response) {
  const event = await loadPublicEventBundle({ eventSlug: req.params.slug });
  if (!event) throw ApiError.notFound("Event not found");
  if (!event.access?.passwordHash) throw ApiError.badRequest("This event is not password-protected");

  const { password } = req.body as { password?: string };
  if (!password) throw ApiError.badRequest("password is required");

  const valid = await verifyPassword(password, event.access.passwordHash);
  if (!valid) throw ApiError.unauthorized("Incorrect password");

  countView(event);
  return ok(res, buildPublicPayload(event));
}

/** GET /api/public/events/:slug/media */
async function getPublicMedia(req: Request, res: Response) {
  const event = await Event.findOne({ eventSlug: req.params.slug }).lean();
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");

  const access = await EventAccess.findOne({ eventId: event._id }).lean();
  if (access?.accessType === EventAccessType.PRIVATE) throw ApiError.forbidden("Unlock the event first");

  const media = await EventMedia.find({ eventId: event._id, status: MediaStatus.ACTIVE }).sort({ sortOrder: 1 }).lean();
  return ok(res, serializeMany(media as Record<string, unknown>[]));
}

/** GET /api/public/events/:slug/theme */
async function getPublicTheme(req: Request, res: Response) {
  const event = await Event.findOne({ eventSlug: req.params.slug }).lean();
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");

  const [theme, themeConfig] = await Promise.all([
    event.themeId ? Theme.findById(event.themeId).lean() : null,
    EventThemeConfig.findOne({ eventId: event._id }).lean(),
  ]);

  return ok(res, {
    theme: serialize(theme as Record<string, unknown> | null),
    config: serialize(themeConfig as Record<string, unknown> | null),
  });
}

/** GET /api/public/events/:slug/share — public URL + QR code + WhatsApp share link (sections 17, 19). */
async function getShareInfo(req: Request, res: Response) {
  const event = await Event.findOne({ eventSlug: req.params.slug }).lean();
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");

  const vendor = await Vendor.findById(event.vendorId).select("whatsappNumber whatsappEnabled").lean();
  if (!vendor) throw ApiError.notFound("Event not found");

  const publicUrl = buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);

  const whatsappShareUrl =
    vendor.whatsappEnabled && vendor.whatsappNumber
      ? `https://wa.me/${vendor.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Watch live: ${event.eventName} — ${publicUrl}`)}`
      : null;

  return ok(res, {
    publicUrl,
    qrCodeDataUrl,
    whatsappShareUrl,
    whatsappSupportNumber: vendor.whatsappEnabled ? vendor.whatsappNumber : null,
  });
}

/** GET /api/public/events — list published live/upcoming public events */
async function listPublicEvents(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));

  const where = {
    isPublished: true,
    isPublic: true,
    status: { $in: [EventStatus.LIVE, EventStatus.UPCOMING] },
  };

  const [items, total] = await Promise.all([
    Event.find(where)
      .select("eventSlug eventName eventType eventDate startTime coverImage status location")
      .sort({ eventDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Event.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

/** GET /api/public/watch/:eventCode — by eventCode */
async function watchByCode(req: Request, res: Response) {
  const event = await loadPublicEventBundle({ eventCode: req.params.eventCode });
  if (!event) throw ApiError.notFound("Event not found");

  const isPrivate = event.access?.accessType === EventAccessType.PRIVATE && event.access.isEnabled;
  if (isPrivate) {
    return ok(res, {
      event: { eventSlug: event.eventSlug, eventCode: event.eventCode, eventName: event.eventName, status: event.status, isPrivate: true },
      requiresPassword: true,
    });
  }

  countView(event);
  return ok(res, buildPublicPayload(event));
}

/** POST /api/public/bookings */
async function createBooking(req: Request, res: Response) {
  const { name, phone, email, eventType, eventDate, location, expectedViewers, message } = req.body;
  if (!name || !phone) throw ApiError.badRequest("name and phone are required");

  const booking = await Booking.create({
    name,
    phone,
    email,
    eventType,
    eventDate: eventDate ? new Date(eventDate) : null,
    location,
    expectedViewers,
    message,
  });
  return created(res, booking.toJSON());
}

/** POST /api/public/contact */
async function createContact(req: Request, res: Response) {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) throw ApiError.badRequest("name, email and message are required");

  const contact = await ContactMessage.create({ name, email, phone, subject, message });
  return created(res, contact.toJSON());
}

/** GET /api/public/pricing */
async function listPricing(_req: Request, res: Response) {
  const plans = await Plan.find({ status: PlanStatus.ACTIVE }).sort({ price: 1 }).lean();
  return ok(res, serializeMany(plans as Record<string, unknown>[]));
}

/** GET /api/public/settings — maintenance flag and public site config */
async function getPublicSettings(_req: Request, res: Response) {
  const keys = ["maintenance_mode", "site_name", "support_email", "support_phone"];
  const rows = await Setting.find({ _id: { $in: keys } }).lean();
  const settings: Record<string, unknown> = {};
  for (const row of rows as { _id: string; value: unknown }[]) {
    settings[row._id] = row.value;
  }
  return ok(res, settings);
}

function buildPublicPayload(event: any) {
  const stream = event.youtubeStreams?.[0];
  const galleryFromEvent = Array.isArray(event.galleryImages)
    ? event.galleryImages
        .filter((url: unknown): url is string => typeof url === "string" && url.length > 0)
        .map((fileUrl: string, index: number) => ({
          id: `gallery-${index}`,
          fileUrl,
          thumbnailUrl: fileUrl,
          type: "IMAGE",
        }))
    : [];
  const mediaRows = [
    ...serializeMany((event.media ?? []) as Record<string, unknown>[]),
    ...galleryFromEvent,
  ];

  return {
    event: {
      id: event._id ?? event.id,
      eventSlug: event.eventSlug,
      eventCode: event.eventCode,
      eventName: event.eventName,
      eventType: event.eventType,
      description: event.themeConfig?.description ?? event.description,
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      location: event.location,
      coverImage: event.themeConfig?.coverImage ?? event.coverImage,
      pageTitle: event.themeConfig?.pageTitle ?? event.pageTitle,
      liveTiming: event.themeConfig?.liveTiming ?? event.liveTiming,
      viewCount: Number(event.viewCount ?? 0),
      status: event.status,
      scrollMessage: event.scrollMessage ?? null,
      teaserUrl: event.teaserUrl ?? null,
      showWatchLive: event.showWatchLive !== false,
      showSocialShare: event.showSocialShare !== false,
      remarks1: event.remarks1 ?? null,
      remarks2: event.remarks2 ?? null,
      fontFamily: event.fontFamily ?? event.themeConfig?.customConfig?.fontFamily ?? null,
      fontColor: event.fontColor ?? event.themeConfig?.primaryColor ?? event.themeConfig?.customConfig?.fontColor ?? null,
      logoImage: event.logoImage ?? event.themeConfig?.logo ?? null,
      customImage: event.customImage ?? null,
      whatsappImage: event.whatsappImage ?? null,
      brideName: event.brideName ?? null,
      groomName: event.groomName ?? null,
      brideImage: event.brideImage ?? null,
      groomImage: event.groomImage ?? null,
      eventTime: event.eventTime ?? null,
      eventPlace: event.eventPlace ?? event.location ?? null,
      invitationCard: event.invitationCard ?? null,
      subEvents: Array.isArray(event.subEvents) ? event.subEvents : [],
      galleryImages: Array.isArray(event.galleryImages) ? event.galleryImages : [],
    },
    theme: event.theme
      ? { name: event.theme.name, slug: event.theme.slug, config: event.theme.config }
      : { name: "Cinematic", slug: "cinematic", config: { preset: "cinematic-live" } },
    branding: {
      companyName: event.vendor?.companyName,
      logo: event.logoImage ?? event.themeConfig?.logo,
      primaryColor: event.fontColor ?? event.themeConfig?.primaryColor,
      secondaryColor: event.themeConfig?.secondaryColor,
      accentColor: event.themeConfig?.accentColor,
      customConfig: event.themeConfig?.customConfig ?? null,
      whatsappNumber: event.whatsappNumber || (event.vendor?.whatsappEnabled ? event.vendor?.whatsappNumber : null),
    },
    youtube: stream
      ? {
          videoId: stream.youtubeVideoId || null,
          liveUrl: stream.youtubeLiveUrl || event.youtubeLiveUrl || null,
          status: stream.status,
        }
      : event.youtubeLiveUrl || event.youtubeVideoId || event.teaserUrl
        ? {
            videoId: event.youtubeVideoId || null,
            liveUrl: event.youtubeLiveUrl || event.teaserUrl || null,
            status: event.status === "LIVE" ? "LIVE" : "SCHEDULED",
          }
        : null,
    media: mediaRows,
  };
}

const router = Router();

router.get("/events", listPublicEvents);
router.get("/events/:slug", getPublicEvent);
router.post("/events/:slug/unlock", unlockPrivateEvent);
router.get("/events/:slug/media", getPublicMedia);
router.get("/events/:slug/theme", getPublicTheme);
router.get("/events/:slug/share", getShareInfo);
router.get("/watch/:eventCode", watchByCode);
router.post("/bookings", createBooking);
router.post("/contact", createContact);
router.get("/pricing", listPricing);
router.get("/settings", getPublicSettings);

export default router;
