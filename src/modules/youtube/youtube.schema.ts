import { z } from "zod";

export const createStreamSchema = z.object({
  eventId: z.string().uuid(),
  youtubeChannelId: z.string().uuid(),
  youtubeVideoId: z.string().optional(),
  youtubeLiveUrl: z.string().url().optional(),
  youtubeLiveKey: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const addChannelManualSchema = z.object({
  channelName: z.string().min(2),
  channelId: z
    .string()
    .min(3)
    .regex(/^[A-Za-z0-9_-]+$/, "Use the YouTube channel ID (e.g. UCxxxxxxxx)"),
});
