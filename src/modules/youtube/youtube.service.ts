import { google } from "googleapis";
import { YoutubeStreamStatus } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { encryptSecret, decryptSecret } from "../../utils/crypto";
import { ApiError } from "../../utils/apiResponse";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

function oauthClient() {
  return new google.auth.OAuth2(env.youtube.clientId, env.youtube.clientSecret, env.youtube.redirectUri);
}

/** Step 1: build the consent-screen URL. `state` should carry the vendorId so the callback knows who's connecting. */
export function buildAuthUrl(state: string) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is returned even on re-connect
    scope: SCOPES,
    state,
  });
}

/** Step 2: exchange the OAuth code for tokens, look up the channel, and persist it (encrypted). */
export async function handleOAuthCallback(code: string, vendorId: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw ApiError.badRequest("Google did not return the expected tokens. Try reconnecting.");
  }
  client.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth: client });
  const channelsResponse = await youtube.channels.list({ part: ["snippet"], mine: true });
  const channel = channelsResponse.data.items?.[0];
  if (!channel?.id) throw ApiError.badRequest("No YouTube channel found for this Google account");

  const record = await prisma.youtubeChannel.upsert({
    where: { vendorId_channelId: { vendorId, channelId: channel.id } },
    create: {
      vendorId,
      channelId: channel.id,
      channelName: channel.snippet?.title ?? undefined,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      status: "CONNECTED",
    },
    update: {
      channelName: channel.snippet?.title ?? undefined,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      status: "CONNECTED",
    },
  });

  return record;
}

async function authorizedClientFor(channelId: string) {
  const channel = await prisma.youtubeChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw ApiError.notFound("YouTube channel not connected");

  const client = oauthClient();
  client.setCredentials({
    access_token: decryptSecret(channel.accessToken),
    refresh_token: decryptSecret(channel.refreshToken),
    expiry_date: channel.tokenExpiry?.getTime(),
  });

  // Refresh proactively if the client rotates the access token; googleapis handles this internally
  // via the "tokens" event, but we persist any rotated token back to the DB here.
  client.on("tokens", async (newTokens) => {
    const data: Record<string, unknown> = {};
    if (newTokens.access_token) data.accessToken = encryptSecret(newTokens.access_token);
    if (newTokens.refresh_token) data.refreshToken = encryptSecret(newTokens.refresh_token);
    if (newTokens.expiry_date) data.tokenExpiry = new Date(newTokens.expiry_date);
    if (Object.keys(data).length) {
      await prisma.youtubeChannel.update({ where: { id: channel.id }, data });
    }
  });

  return client;
}

export async function disconnectChannel(channelId: string) {
  await prisma.youtubeChannel.update({ where: { id: channelId }, data: { status: "DISCONNECTED" } });
}

/**
 * Polls YouTube for the live status of every active stream and syncs
 * youtube_streams.status + events.status accordingly (see architecture
 * doc section 15 — this is what flips a public event page to "LIVE").
 */
export async function syncStreamStatuses(eventId?: string) {
  const streams = await prisma.youtubeStream.findMany({
    where: {
      eventId,
      status: { in: [YoutubeStreamStatus.SCHEDULED, YoutubeStreamStatus.LIVE, YoutubeStreamStatus.CONNECTED] },
    },
    include: { youtubeChannel: true, event: true },
  });

  const results = [];
  for (const stream of streams) {
    if (!stream.youtubeVideoId) continue;
    try {
      const client = await authorizedClientFor(stream.youtubeChannelId);
      const youtube = google.youtube({ version: "v3", auth: client });
      const response = await youtube.videos.list({ part: ["liveStreamingDetails", "status"], id: [stream.youtubeVideoId] });
      const video = response.data.items?.[0];
      const lifeCycle = video?.status?.uploadStatus;
      const isLive = !!video?.liveStreamingDetails?.actualStartTime && !video?.liveStreamingDetails?.actualEndTime;
      const hasEnded = !!video?.liveStreamingDetails?.actualEndTime;

      let status: YoutubeStreamStatus = stream.status;
      if (isLive) status = YoutubeStreamStatus.LIVE;
      else if (hasEnded) status = YoutubeStreamStatus.ENDED;
      else if (lifeCycle === "failed" || lifeCycle === "rejected") status = YoutubeStreamStatus.ERROR;

      await prisma.$transaction([
        prisma.youtubeStream.update({
          where: { id: stream.id },
          data: {
            status,
            startedAt: video?.liveStreamingDetails?.actualStartTime ? new Date(video.liveStreamingDetails.actualStartTime) : stream.startedAt,
            endedAt: video?.liveStreamingDetails?.actualEndTime ? new Date(video.liveStreamingDetails.actualEndTime) : stream.endedAt,
          },
        }),
        prisma.event.update({
          where: { id: stream.eventId },
          data: { status: status === "LIVE" ? "LIVE" : status === "ENDED" ? "COMPLETED" : stream.event.status },
        }),
      ]);

      results.push({ streamId: stream.id, status });
    } catch (err) {
      await prisma.youtubeStream.update({ where: { id: stream.id }, data: { status: YoutubeStreamStatus.ERROR } });
      results.push({ streamId: stream.id, status: "ERROR", error: (err as Error).message });
    }
  }
  return results;
}
