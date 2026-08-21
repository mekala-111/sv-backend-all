import { Request, Response } from "express";
import { UserRole, YoutubeStreamStatus, YoutubeChannelStatus } from "../../types/enums";
import { YoutubeChannel, YoutubeStream, Event, Vendor, Customer } from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import * as youtubeService from "./youtube.service";
import { writeAuditLog } from "../../middleware/auditLog";
import { createNotification } from "../notifications/notifications.service";
import { env } from "../../config/env";
import { serialize } from "../../utils/serialize";
import { encryptSecret } from "../../utils/crypto";

function isAdmin(req: Request) {
  return req.auth!.role === UserRole.SUPER_ADMIN || req.auth!.role === UserRole.ADMIN;
}

export async function listChannels(req: Request, res: Response) {
  const where = isAdmin(req) ? {} : { vendorId: req.auth!.vendorId! };
  const channels = await YoutubeChannel.find(where)
    .select("channelId channelName status tokenExpiry vendorId createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  const vendorIds = [...new Set(channels.map((c: { vendorId: string }) => c.vendorId))];
  const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("companyName").lean();
  const vendorName = new Map(vendors.map((v: { _id: string; companyName: string }) => [v._id, v.companyName]));

  const channelIds = channels.map((c: { _id: string }) => c._id);
  const streamCounts = await YoutubeStream.aggregate([
    { $match: { youtubeChannelId: { $in: channelIds } } },
    {
      $group: {
        _id: "$youtubeChannelId",
        total: { $sum: 1 },
        live: {
          $sum: { $cond: [{ $eq: ["$status", YoutubeStreamStatus.LIVE] }, 1, 0] },
        },
      },
    },
  ]);
  const countsByChannel = new Map(
    streamCounts.map((r: { _id: string; total: number; live: number }) => [r._id, { total: r.total, live: r.live }])
  );

  return ok(
    res,
    channels.map((c: Record<string, unknown> & { _id: string; vendorId: string }) => {
      const counts = countsByChannel.get(c._id) ?? { total: 0, live: 0 };
      return {
        ...serialize(c),
        vendorName: vendorName.get(c.vendorId) ?? null,
        streamsCount: counts.total,
        liveStreamsCount: counts.live,
      };
    })
  );
}

export async function getChannel(req: Request, res: Response) {
  const channel = await YoutubeChannel.findById(req.params.id)
    .select("channelId channelName status tokenExpiry vendorId createdAt updatedAt")
    .lean();
  if (!channel) throw ApiError.notFound();
  if (!isAdmin(req) && channel.vendorId !== req.auth!.vendorId) throw ApiError.notFound();

  const vendor = await Vendor.findById(channel.vendorId).select("companyName").lean();
  const [total, live] = await Promise.all([
    YoutubeStream.countDocuments({ youtubeChannelId: channel._id }),
    YoutubeStream.countDocuments({ youtubeChannelId: channel._id, status: YoutubeStreamStatus.LIVE }),
  ]);

  return ok(res, {
    ...serialize(channel as Record<string, unknown>),
    vendorName: vendor?.companyName ?? null,
    streamsCount: total,
    liveStreamsCount: live,
  });
}

/** Kicks off OAuth — returns a consent URL for the frontend to redirect the vendor to. */
export async function connect(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  if (!vendorId) throw ApiError.forbidden("Only vendors can connect YouTube channels");
  if (!env.youtube.clientId || !env.youtube.clientSecret) {
    throw ApiError.badRequest(
      "YouTube OAuth is not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in the backend .env."
    );
  }
  const url = youtubeService.buildAuthUrl(vendorId);
  return ok(res, { authUrl: url });
}

export async function oauthStatus(_req: Request, res: Response) {
  return ok(res, {
    configured: Boolean(env.youtube.clientId && env.youtube.clientSecret),
    redirectUri: env.youtube.redirectUri,
  });
}

/** Dev/local fallback when Google OAuth credentials are not set. */
export async function addChannelManual(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  if (!vendorId) throw ApiError.forbidden("Only vendors can add YouTube channels");

  const { channelName, channelId } = req.body as { channelName: string; channelId: string };
  const existing = await YoutubeChannel.findOne({ vendorId, channelId });
  if (existing) throw ApiError.conflict("This YouTube channel is already linked");

  const channel = await YoutubeChannel.create({
    vendorId,
    channelId,
    channelName,
    accessToken: encryptSecret("manual-placeholder"),
    refreshToken: encryptSecret("manual-placeholder"),
    status: YoutubeChannelStatus.CONNECTED,
  });

  await writeAuditLog(req, {
    action: "CREATE",
    module: "youtube_channels",
    entityId: channel._id,
    newData: { channelId, channelName, manual: true },
  });

  return created(res, serialize(channel.toJSON() as Record<string, unknown>));
}

/** Google redirects here with ?code=...&state=<vendorId> after consent — sends the vendor's browser back into the panel rather than returning raw JSON. */
export async function callback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };
  const youtubePage = `${env.vendorPanelBaseUrl}/vendor/youtube`;
  if (!code || !state) return res.redirect(`${youtubePage}?error=${encodeURIComponent("Missing code or state")}`);

  try {
    const channel = await youtubeService.handleOAuthCallback(code, state);
    const vendor = await Vendor.findById(state);
    if (vendor) {
      await createNotification(
        vendor.userId,
        "YOUTUBE_CONNECTED",
        "YouTube channel connected",
        `Connected channel: ${channel.channelName ?? channel.channelId}`
      );
    }
    return res.redirect(`${youtubePage}?connected=1`);
  } catch (err) {
    const vendor = await Vendor.findById(state);
    if (vendor) {
      await createNotification(vendor.userId, "YOUTUBE_ERROR", "YouTube connection failed", (err as Error).message);
    }
    return res.redirect(`${youtubePage}?error=${encodeURIComponent((err as Error).message)}`);
  }
}

export async function disconnect(req: Request, res: Response) {
  const channel = await YoutubeChannel.findById(req.params.id);
  if (!channel || channel.vendorId !== req.auth!.vendorId) throw ApiError.notFound();

  await youtubeService.disconnectChannel(channel._id);
  await writeAuditLog(req, {
    action: "UPDATE",
    module: "youtube_channels",
    entityId: channel._id,
    newData: { status: "DISCONNECTED" },
  });
  return ok(res, { disconnected: true });
}

export async function listStreams(req: Request, res: Response) {
  let eventFilter: Record<string, unknown> = {};
  if (!isAdmin(req)) {
    eventFilter = { vendorId: req.auth!.vendorId! };
  }

  const events = (await Event.find(eventFilter).select("_id eventName eventSlug vendorId customerId").lean()) as Array<{
    _id: string;
    eventName: string;
    eventSlug: string;
    vendorId: string;
    customerId?: string | null;
  }>;
  const eventById = new Map(events.map((e) => [e._id, e]));

  const streams = await YoutubeStream.find(
    isAdmin(req) ? {} : { eventId: { $in: events.map((e) => e._id) } }
  )
    .sort({ createdAt: -1 })
    .lean();

  const vendorIds = [...new Set(events.map((e) => e.vendorId))];
  const customerIds = [...new Set(events.map((e) => e.customerId).filter(Boolean))] as string[];
  const channelIds = [...new Set(streams.map((s: { youtubeChannelId: string }) => s.youtubeChannelId))];

  const [vendors, customers, channels] = await Promise.all([
    Vendor.find({ _id: { $in: vendorIds } }).select("companyName").lean(),
    Customer.find({ _id: { $in: customerIds } }).select("name").lean(),
    YoutubeChannel.find({ _id: { $in: channelIds } }).select("channelName channelId").lean(),
  ]);
  const vendorName = new Map(vendors.map((v: { _id: string; companyName: string }) => [v._id, v.companyName]));
  const customerName = new Map(customers.map((c: { _id: string; name: string }) => [c._id, c.name]));
  const channelById = new Map(
    channels.map((c: { _id: string; channelName?: string | null; channelId: string }) => [c._id, c])
  );

  return ok(
    res,
    streams.map((s: { eventId: string; youtubeChannelId: string } & Record<string, unknown>) => {
      const event = eventById.get(s.eventId);
      const channel = channelById.get(s.youtubeChannelId);
      return {
        ...serialize(s),
        event: event
          ? { id: event._id, eventName: event.eventName, eventSlug: event.eventSlug }
          : null,
        vendorName: event ? vendorName.get(event.vendorId) ?? null : null,
        customerName: event?.customerId ? customerName.get(event.customerId) ?? null : null,
        channelName: channel?.channelName ?? channel?.channelId ?? null,
      };
    })
  );
}

export async function getStream(req: Request, res: Response) {
  const stream = await YoutubeStream.findById(req.params.id).lean();
  if (!stream) throw ApiError.notFound();
  const event = await Event.findById(stream.eventId).lean();
  if (!event) throw ApiError.notFound();
  if (!isAdmin(req) && event.vendorId !== req.auth!.vendorId) throw ApiError.notFound();

  const [vendor, customer, channel] = await Promise.all([
    Vendor.findById(event.vendorId).select("companyName").lean(),
    event.customerId ? Customer.findById(event.customerId).select("name").lean() : null,
    YoutubeChannel.findById(stream.youtubeChannelId).select("channelName channelId").lean(),
  ]);

  return ok(res, {
    ...serialize(stream as Record<string, unknown>),
    event: serialize(event as Record<string, unknown>),
    vendorName: vendor?.companyName ?? null,
    customerName: customer?.name ?? null,
    channelName: channel?.channelName ?? channel?.channelId ?? null,
  });
}

/** Creates the youtube_streams row for an event, linking it to a connected channel. */
export async function createStream(req: Request, res: Response) {
  const { eventId, youtubeChannelId, youtubeVideoId, youtubeLiveUrl, youtubeLiveKey, scheduledAt } = req.body;

  const event = await Event.findById(eventId);
  if (!event || event.vendorId !== req.auth!.vendorId) throw ApiError.notFound("Event not found");

  const channel = await YoutubeChannel.findById(youtubeChannelId);
  if (!channel || channel.vendorId !== req.auth!.vendorId) throw ApiError.notFound("YouTube channel not found");

  const stream = await YoutubeStream.create({
    eventId,
    youtubeChannelId,
    youtubeVideoId,
    youtubeLiveUrl,
    youtubeLiveKey,
    scheduledAt,
    status: YoutubeStreamStatus.SCHEDULED,
  });

  event.youtubeChannelId = youtubeChannelId;
  event.youtubeVideoId = youtubeVideoId;
  event.youtubeLiveUrl = youtubeLiveUrl;
  await event.save();

  return created(res, stream.toJSON());
}

/** Manually triggers a status sync (also intended to run on a schedule/cron). */
export async function syncStreams(req: Request, res: Response) {
  const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
  const results = await youtubeService.syncStreamStatuses(eventId);
  return ok(res, results);
}
