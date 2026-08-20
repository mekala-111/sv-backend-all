import { Router, Request, Response } from "express";
import QRCode from "qrcode";
import { prisma } from "../../config/prisma";
import { ApiError, ok } from "../../utils/apiResponse";
import { buildPublicEventUrl } from "../../utils/slug";
import { env } from "../../config/env";
import { verifyPassword } from "../../utils/password";

/**
 * GET /api/public/events/:slug
 * Returns { event, theme, branding, youtube, media } — exactly what the
 * public viewer frontend needs to render the event page. No vendor/admin
 * auth required (section 16). Private events return access metadata only,
 * requiring a follow-up password check before real content is exposed.
 */
async function getPublicEvent(req: Request, res: Response) {
  const event = await prisma.event.findUnique({
    where: { eventSlug: req.params.slug },
    include: {
      theme: true,
      themeConfig: true,
      media: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      access: true,
      youtubeStreams: { orderBy: { createdAt: "desc" }, take: 1 },
      vendor: { select: { companyName: true, whatsappNumber: true, whatsappEnabled: true } },
    },
  });

  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");

  const isPrivate = event.access?.accessType === "PRIVATE" && event.access.isEnabled;

  if (isPrivate) {
    // Don't leak event details until the password check passes.
    return ok(res, {
      event: { eventSlug: event.eventSlug, eventName: event.eventName, status: event.status, isPrivate: true },
      requiresPassword: true,
    });
  }

  return ok(res, buildPublicPayload(event));
}

/** POST /api/public/events/:slug/unlock — verifies a private event's password and returns full payload. */
async function unlockPrivateEvent(req: Request, res: Response) {
  const event = await prisma.event.findUnique({
    where: { eventSlug: req.params.slug },
    include: {
      theme: true,
      themeConfig: true,
      media: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      access: true,
      youtubeStreams: { orderBy: { createdAt: "desc" }, take: 1 },
      vendor: { select: { companyName: true, whatsappNumber: true, whatsappEnabled: true } },
    },
  });

  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");
  if (!event.access?.passwordHash) throw ApiError.badRequest("This event is not password-protected");

  const { password } = req.body as { password?: string };
  if (!password) throw ApiError.badRequest("password is required");

  const valid = await verifyPassword(password, event.access.passwordHash);
  if (!valid) throw ApiError.unauthorized("Incorrect password");

  return ok(res, buildPublicPayload(event));
}

/** GET /api/public/events/:slug/media */
async function getPublicMedia(req: Request, res: Response) {
  const event = await prisma.event.findUnique({ where: { eventSlug: req.params.slug } });
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");

  const isPrivate = (await prisma.eventAccess.findUnique({ where: { eventId: event.id } }))?.accessType === "PRIVATE";
  if (isPrivate) throw ApiError.forbidden("Unlock the event first");

  const media = await prisma.eventMedia.findMany({ where: { eventId: event.id, status: "ACTIVE" }, orderBy: { sortOrder: "asc" } });
  return ok(res, media);
}

/** GET /api/public/events/:slug/theme */
async function getPublicTheme(req: Request, res: Response) {
  const event = await prisma.event.findUnique({ where: { eventSlug: req.params.slug }, include: { theme: true, themeConfig: true } });
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");
  return ok(res, { theme: event.theme, config: event.themeConfig });
}

/** GET /api/public/events/:slug/share — public URL + QR code + WhatsApp share link (sections 17, 19). */
async function getShareInfo(req: Request, res: Response) {
  const event = await prisma.event.findUnique({
    where: { eventSlug: req.params.slug },
    include: { vendor: { select: { whatsappNumber: true, whatsappEnabled: true } } },
  });
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");

  const publicUrl = buildPublicEventUrl(env.publicEventBaseUrl, event.eventSlug);
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);

  const whatsappShareUrl = event.vendor.whatsappEnabled && event.vendor.whatsappNumber
    ? `https://wa.me/${event.vendor.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Watch live: ${event.eventName} — ${publicUrl}`)}`
    : null;

  return ok(res, {
    publicUrl,
    qrCodeDataUrl,
    whatsappShareUrl,
    whatsappSupportNumber: event.vendor.whatsappEnabled ? event.vendor.whatsappNumber : null,
  });
}

function buildPublicPayload(event: any) {
  return {
    event: {
      id: event.id,
      eventSlug: event.eventSlug,
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
      status: event.status,
    },
    theme: event.theme
      ? { name: event.theme.name, slug: event.theme.slug, config: event.theme.config }
      : null,
    branding: {
      companyName: event.vendor?.companyName,
      logo: event.themeConfig?.logo,
      primaryColor: event.themeConfig?.primaryColor,
      secondaryColor: event.themeConfig?.secondaryColor,
      accentColor: event.themeConfig?.accentColor,
      customConfig: event.themeConfig?.customConfig ?? null,
    },
    youtube: event.youtubeStreams[0]
      ? {
          videoId: event.youtubeStreams[0].youtubeVideoId,
          liveUrl: event.youtubeStreams[0].youtubeLiveUrl,
          status: event.youtubeStreams[0].status,
        }
      : event.youtubeVideoId
        ? { videoId: event.youtubeVideoId, liveUrl: event.youtubeLiveUrl, status: event.status === "LIVE" ? "LIVE" : "SCHEDULED" }
        : null,
    media: event.media,
  };
}

const router = Router();

router.get("/events/:slug", getPublicEvent);
router.post("/events/:slug/unlock", unlockPrivateEvent);
router.get("/events/:slug/media", getPublicMedia);
router.get("/events/:slug/theme", getPublicTheme);
router.get("/events/:slug/share", getShareInfo);

export default router;
