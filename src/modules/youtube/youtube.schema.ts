import { z } from "zod";

export const createStreamSchema = z.object({
  eventId: z.string().uuid(),
  youtubeChannelId: z.string().uuid(),
  youtubeVideoId: z.string().optional(),
  youtubeLiveUrl: z.string().url().optional(),
  scheduledAt: z.coerce.date().optional(),
});
