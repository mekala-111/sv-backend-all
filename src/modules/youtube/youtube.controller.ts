import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { ApiError, created, ok } from "../../utils/apiResponse";
import * as youtubeService from "./youtube.service";
import { writeAuditLog } from "../../middleware/auditLog";
import { createNotification } from "../notifications/notifications.service";
import { env } from "../../config/env";

export async function listChannels(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  const channels = await prisma.youtubeChannel.findMany({
    where: { vendorId },
    select: { id: true, channelId: true, channelName: true, status: true, tokenExpiry: true, createdAt: true },
  });
  return ok(res, channels);
}

/** Kicks off OAuth — returns a consent URL for the frontend to redirect the vendor to. */
export async function connect(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  const url = youtubeService.buildAuthUrl(vendorId);
  return ok(res, { authUrl: url });
}

/** Google redirects here with ?code=...&state=<vendorId> after consent — sends the vendor's browser back into the panel rather than returning raw JSON. */
export async function callback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };
  const youtubePage = `${env.vendorPanelBaseUrl}/vendor/youtube`;
  if (!code || !state) return res.redirect(`${youtubePage}?error=${encodeURIComponent("Missing code or state")}`);

  try {
    const channel = await youtubeService.handleOAuthCallback(code, state);
    const vendor = await prisma.vendor.findUnique({ where: { id: state } });
    if (vendor) {
      await createNotification(vendor.userId, "YOUTUBE_CONNECTED", "YouTube channel connected", `Connected channel: ${channel.channelName ?? channel.channelId}`);
    }
    return res.redirect(`${youtubePage}?connected=1`);
  } catch (err) {
    const vendor = await prisma.vendor.findUnique({ where: { id: state } });
    if (vendor) {
      await createNotification(vendor.userId, "YOUTUBE_ERROR", "YouTube connection failed", (err as Error).message);
    }
    return res.redirect(`${youtubePage}?error=${encodeURIComponent((err as Error).message)}`);
  }
}

export async function disconnect(req: Request, res: Response) {
  const channel = await prisma.youtubeChannel.findUnique({ where: { id: req.params.id } });
  if (!channel || channel.vendorId !== req.auth!.vendorId) throw ApiError.notFound();

  await youtubeService.disconnectChannel(channel.id);
  await writeAuditLog(req, { action: "UPDATE", module: "youtube_channels", entityId: channel.id, newData: { status: "DISCONNECTED" } });
  return ok(res, { disconnected: true });
}

export async function listStreams(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  const streams = await prisma.youtubeStream.findMany({
    where: { event: { vendorId } },
    include: { event: { select: { id: true, eventName: true, eventSlug: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, streams);
}

export async function getStream(req: Request, res: Response) {
  const stream = await prisma.youtubeStream.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });
  if (!stream || stream.event.vendorId !== req.auth!.vendorId) throw ApiError.notFound();
  return ok(res, stream);
}

/** Creates the youtube_streams row for an event, linking it to a connected channel. */
export async function createStream(req: Request, res: Response) {
  const { eventId, youtubeChannelId, youtubeVideoId, youtubeLiveUrl, scheduledAt } = req.body;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.vendorId !== req.auth!.vendorId) throw ApiError.notFound("Event not found");

  const channel = await prisma.youtubeChannel.findUnique({ where: { id: youtubeChannelId } });
  if (!channel || channel.vendorId !== req.auth!.vendorId) throw ApiError.notFound("YouTube channel not found");

  const stream = await prisma.youtubeStream.create({
    data: { eventId, youtubeChannelId, youtubeVideoId, youtubeLiveUrl, scheduledAt, status: "SCHEDULED" },
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { youtubeChannelId, youtubeVideoId, youtubeLiveUrl },
  });

  return created(res, stream);
}

/** Manually triggers a status sync (also intended to run on a schedule/cron). */
export async function syncStreams(req: Request, res: Response) {
  const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
  const results = await youtubeService.syncStreamStatuses(eventId);
  return ok(res, results);
}
