import { InferSchemaType } from "mongoose";
import { createSchema, getModel } from "./base";
import { EventStatus } from "../types/enums";

const eventSchema = createSchema({
  vendorId: { type: String, required: true, index: true },
  customerId: { type: String, default: null, index: true },
  eventCode: { type: String, required: true, unique: true },
  eventSlug: { type: String, required: true, unique: true },
  eventName: { type: String, required: true },
  eventType: { type: String, default: null },
  description: { type: String, default: null },
  eventDate: { type: Date, default: null },
  startTime: { type: Date, default: null },
  endTime: { type: Date, default: null },
  timezone: { type: String, default: "Asia/Kolkata" },
  location: { type: String, default: null },
  googleMapsUrl: { type: String, default: null },
  coverImage: { type: String, default: null },
  pageTitle: { type: String, default: null },
  metaTitle: { type: String, default: null },
  metaDescription: { type: String, default: null },
  liveTiming: { type: String, default: null },
  /** Public page views (incremented by the public event endpoints). */
  viewCount: { type: Number, default: 0 },
  status: { type: String, enum: Object.values(EventStatus), default: EventStatus.DRAFT, index: true },
  themeId: { type: String, default: null },
  youtubeChannelId: { type: String, default: null },
  youtubeVideoId: { type: String, default: null },
  youtubeLiveUrl: { type: String, default: null },
  teaserUrl: { type: String, default: null },
  scrollMessage: { type: String, default: null },
  galleryImages: { type: [String], default: [] },
  brideName: { type: String, default: null },
  groomName: { type: String, default: null },
  brideImage: { type: String, default: null },
  groomImage: { type: String, default: null },
  /** Display time text for the theme (e.g. "6:00 PM IST") */
  eventTime: { type: String, default: null },
  /** Venue / place shown on the theme (mirrors location when set here) */
  eventPlace: { type: String, default: null },
  invitationCard: { type: String, default: null },
  subEvents: {
    type: [
      {
        _id: false,
        title: { type: String, required: true },
        date: { type: String, default: null },
        time: { type: String, default: null },
        place: { type: String, default: null },
        image: { type: String, default: null },
      },
    ],
    default: [],
  },
  logoImage: { type: String, default: null },
  customImage: { type: String, default: null },
  whatsappImage: { type: String, default: null },
  showWatchLive: { type: Boolean, default: true },
  showSocialShare: { type: Boolean, default: true },
  remarks1: { type: String, default: null },
  remarks2: { type: String, default: null },
  fontFamily: { type: String, default: null },
  fontColor: { type: String, default: null },
  accessPin: { type: String, default: null },
  isPublic: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  whatsappNumber: { type: String, default: null },
  whatsappEnabled: { type: Boolean, default: false },
});

export type EventDoc = InferSchemaType<typeof eventSchema> & { _id: string; id: string };
export const Event = getModel("Event", eventSchema, "events");
