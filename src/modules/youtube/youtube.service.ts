import { google } from "googleapis";
import { YoutubeStreamStatus, YoutubeChannelStatus, EventStatus } from "../../types/enums";
import { env } from "../../config/env";
import { YoutubeChannel, YoutubeStream, Event } from "../../models";
import { encryptSecret, decryptSecret } from "../../utils/crypto";
import { ApiError } from "../../utils/apiResponse";
import { runInTransaction } from "../../utils/transaction";

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

  const record = await YoutubeChannel.findOneAndUpdate(
    { vendorId, channelId: channel.id },
    {
      $set: {
        channelName: channel.snippet?.title ?? undefined,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        status: YoutubeChannelStatus.CONNECTED,
      },
      $setOnInsert: {
        vendorId,
        channelId: channel.id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return record;
}

async function authorizedClientFor(channelId: string) {
  const channel = await YoutubeChannel.findById(channelId);
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
      await YoutubeChannel.findByIdAndUpdate(channel._id, data);
    }
  });

  return client;
}

export async function disconnectChannel(channelId: string) {
  await YoutubeChannel.findByIdAndUpdate(channelId, { status: YoutubeChannelStatus.DISCONNECTED });
}

/**
 * Polls YouTube for the live status of every active stream and syncs
 * youtube_streams.status + events.status accordingly (see architecture
 * doc section 15 — this is what flips a public event page to "LIVE").
 */
export async function syncStreamStatuses(eventId?: string) {
  const filter: Record<string, unknown> = {
    status: { $in: [YoutubeStreamStatus.SCHEDULED, YoutubeStreamStatus.LIVE, YoutubeStreamStatus.CONNECTED] },
  };
  if (eventId) filter.eventId = eventId;

  const streams = await YoutubeStream.find(filter);
  const results = [];

  for (const stream of streams) {
    if (!stream.youtubeVideoId) continue;
    const event = await Event.findById(stream.eventId);
    if (!event) continue;

    try {
      const client = await authorizedClientFor(stream.youtubeChannelId);
      const youtube = google.youtube({ version: "v3", auth: client });
      const response = await youtube.videos.list({
        part: ["liveStreamingDetails", "status"],
        id: [stream.youtubeVideoId],
      });
      const video = response.data.items?.[0];
      const lifeCycle = video?.status?.uploadStatus;
      const isLive = !!video?.liveStreamingDetails?.actualStartTime && !video?.liveStreamingDetails?.actualEndTime;
      const hasEnded = !!video?.liveStreamingDetails?.actualEndTime;

      let status: YoutubeStreamStatus = stream.status as YoutubeStreamStatus;
      if (isLive) status = YoutubeStreamStatus.LIVE;
      else if (hasEnded) status = YoutubeStreamStatus.ENDED;
      else if (lifeCycle === "failed" || lifeCycle === "rejected") status = YoutubeStreamStatus.ERROR;

      await runInTransaction(async (session) => {
        stream.status = status;
        if (video?.liveStreamingDetails?.actualStartTime) {
          stream.startedAt = new Date(video.liveStreamingDetails.actualStartTime);
        }
        if (video?.liveStreamingDetails?.actualEndTime) {
          stream.endedAt = new Date(video.liveStreamingDetails.actualEndTime);
        }
        await stream.save({ session });

        if (status === YoutubeStreamStatus.LIVE) event.status = EventStatus.LIVE;
        else if (status === YoutubeStreamStatus.ENDED) event.status = EventStatus.COMPLETED;
        await event.save({ session });

      });

      results.push({ streamId: stream._id, status });
    } catch (err) {
      stream.status = YoutubeStreamStatus.ERROR;
      await stream.save();
      results.push({ streamId: stream._id, status: "ERROR", error: (err as Error).message });
    }
  }
  return results;
}
