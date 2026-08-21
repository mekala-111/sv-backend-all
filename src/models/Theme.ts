import { InferSchemaType, Schema } from "mongoose";
import { createSchema, createSchemaNoUpdateAt, getModel } from "./base";
import { ThemeStatus, MediaType, MediaStatus, EventAccessType } from "../types/enums";

const themeCategorySchema = createSchemaNoUpdateAt({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
});

const themeSchema = createSchema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  categoryId: { type: String, default: null },
  previewImage: { type: String, default: null },
  config: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: Object.values(ThemeStatus), default: ThemeStatus.DRAFT },
  createdBy: { type: String, default: null },
});

const vendorThemeSchema = createSchemaNoUpdateAt(
  {
    vendorId: { type: String, required: true },
    themeId: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);
vendorThemeSchema.index({ vendorId: 1, themeId: 1 }, { unique: true });

const eventThemeConfigSchema = createSchema(
  {
    eventId: { type: String, required: true, unique: true },
    themeId: { type: String, required: true },
    primaryColor: { type: String, default: null },
    secondaryColor: { type: String, default: null },
    accentColor: { type: String, default: null },
    logo: { type: String, default: null },
    coverImage: { type: String, default: null },
    pageTitle: { type: String, default: null },
    description: { type: String, default: null },
    liveTiming: { type: String, default: null },
    customConfig: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const eventMediaSchema = createSchemaNoUpdateAt({
  eventId: { type: String, required: true, index: true },
  type: { type: String, enum: Object.values(MediaType), required: true },
  fileUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: Object.values(MediaStatus), default: MediaStatus.ACTIVE },
});

const eventAccessSchema = createSchema(
  {
    eventId: { type: String, required: true, unique: true },
    accessType: { type: String, enum: Object.values(EventAccessType), default: EventAccessType.PUBLIC },
    passwordHash: { type: String, default: null },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export type ThemeCategoryDoc = InferSchemaType<typeof themeCategorySchema> & { _id: string; id: string };
export type ThemeDoc = InferSchemaType<typeof themeSchema> & { _id: string; id: string };
export type VendorThemeDoc = InferSchemaType<typeof vendorThemeSchema> & { _id: string; id: string };
export type EventThemeConfigDoc = InferSchemaType<typeof eventThemeConfigSchema> & { _id: string; id: string };
export type EventMediaDoc = InferSchemaType<typeof eventMediaSchema> & { _id: string; id: string };
export type EventAccessDoc = InferSchemaType<typeof eventAccessSchema> & { _id: string; id: string };

export const ThemeCategory = getModel("ThemeCategory", themeCategorySchema, "theme_categories");
export const Theme = getModel("Theme", themeSchema, "themes");
export const VendorTheme = getModel("VendorTheme", vendorThemeSchema, "vendor_themes");
export const EventThemeConfig = getModel("EventThemeConfig", eventThemeConfigSchema, "event_theme_configs");
export const EventMedia = getModel("EventMedia", eventMediaSchema, "event_media");
export const EventAccess = getModel("EventAccess", eventAccessSchema, "event_access");
