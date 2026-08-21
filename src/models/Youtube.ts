import { InferSchemaType } from "mongoose";
import { createSchema, getModel } from "./base";
import { YoutubeChannelStatus, YoutubeStreamStatus } from "../types/enums";

const youtubeChannelSchema = createSchema({
  vendorId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  channelName: { type: String, default: null },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  tokenExpiry: { type: Date, default: null },
  status: { type: String, enum: Object.values(YoutubeChannelStatus), default: YoutubeChannelStatus.CONNECTED },
});
youtubeChannelSchema.index({ vendorId: 1, channelId: 1 }, { unique: true });

const youtubeStreamSchema = createSchema({
  eventId: { type: String, required: true, index: true },
  youtubeChannelId: { type: String, required: true },
  youtubeVideoId: { type: String, default: null },
  youtubeLiveUrl: { type: String, default: null },
  youtubeLiveKey: { type: String, default: null },
  status: { type: String, enum: Object.values(YoutubeStreamStatus), default: YoutubeStreamStatus.SCHEDULED },
  scheduledAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
});

export type YoutubeChannelDoc = InferSchemaType<typeof youtubeChannelSchema> & { _id: string; id: string };
export type YoutubeStreamDoc = InferSchemaType<typeof youtubeStreamSchema> & { _id: string; id: string };

export const YoutubeChannel = getModel("YoutubeChannel", youtubeChannelSchema, "youtube_channels");
export const YoutubeStream = getModel("YoutubeStream", youtubeStreamSchema, "youtube_streams");
