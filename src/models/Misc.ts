import { InferSchemaType, Schema } from "mongoose";
import { createSchema, createSchemaNoUpdateAt, getModel } from "./base";
import { UserRole, TicketStatus, TicketPriority, BookingStatus, PlanStatus } from "../types/enums";

const notificationSchema = createSchemaNoUpdateAt({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: null },
  isRead: { type: Boolean, default: false },
});

const auditLogSchema = createSchemaNoUpdateAt({
  userId: { type: String, default: null, index: true },
  role: { type: String, enum: [...Object.values(UserRole), null], default: null },
  action: { type: String, required: true },
  module: { type: String, required: true, index: true },
  entityType: { type: String, default: null },
  entityId: { type: String, default: null },
  oldData: { type: Schema.Types.Mixed, default: null },
  newData: { type: Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
});

const settingSchema = new Schema(
  {
    _id: { type: String }, // key
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false }
);
settingSchema.set("toJSON", {
  transform(_doc, ret: Record<string, unknown>) {
    ret.key = ret._id;
    delete ret._id;
    return ret;
  },
});

const planSchema = createSchema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  price: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },
  billingPeriod: { type: String, default: "monthly" },
  eventLimit: { type: Number, default: 10 },
  hoursLimit: { type: Number, default: 50 },
  storageGb: { type: Number, default: 100 },
  viewerLimit: { type: Number, default: 500 },
  features: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: Object.values(PlanStatus), default: PlanStatus.ACTIVE },
});

const vendorPricingSchema = createSchema({
  vendorId: { type: String, required: true, unique: true },
  items: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      currency: { type: String, default: "INR" },
      description: { type: String, default: null },
    },
  ],
});

const supportTicketSchema = createSchema({
  ticketCode: { type: String, required: true, unique: true },
  vendorId: { type: String, default: null, index: true },
  customerId: { type: String, default: null },
  userId: { type: String, required: true },
  subject: { type: String, required: true },
  category: { type: String, default: "General" },
  priority: { type: String, enum: Object.values(TicketPriority), default: TicketPriority.MEDIUM },
  status: { type: String, enum: Object.values(TicketStatus), default: TicketStatus.OPEN },
  assignedTo: { type: String, default: null },
  messages: [
    {
      authorId: String,
      authorRole: String,
      body: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

const bookingSchema = createSchemaNoUpdateAt({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: null },
  eventType: { type: String, default: null },
  eventDate: { type: Date, default: null },
  location: { type: String, default: null },
  expectedViewers: { type: String, default: null },
  message: { type: String, default: null },
  status: { type: String, enum: Object.values(BookingStatus), default: BookingStatus.NEW },
  assignedVendorId: { type: String, default: null },
});

const recordingSchema = createSchemaNoUpdateAt({
  eventId: { type: String, required: true, index: true },
  vendorId: { type: String, required: true, index: true },
  youtubeVideoId: { type: String, default: null },
  fileUrl: { type: String, default: null },
  thumbnailUrl: { type: String, default: null },
  sizeBytes: { type: Number, default: 0 },
  durationSec: { type: Number, default: 0 },
  status: { type: String, default: "READY" },
});

const contactMessageSchema = createSchemaNoUpdateAt({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: null },
  subject: { type: String, default: null },
  message: { type: String, required: true },
  status: { type: String, default: "NEW" },
});

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & { _id: string; id: string };
export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & { _id: string; id: string };
export type PlanDoc = InferSchemaType<typeof planSchema> & { _id: string; id: string };
export type SupportTicketDoc = InferSchemaType<typeof supportTicketSchema> & { _id: string; id: string };
export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: string; id: string };
export type RecordingDoc = InferSchemaType<typeof recordingSchema> & { _id: string; id: string };

export const Notification = getModel("Notification", notificationSchema, "notifications");
export const AuditLog = getModel("AuditLog", auditLogSchema, "audit_logs");
export const Setting = getModel("Setting", settingSchema, "settings");
export const Plan = getModel("Plan", planSchema, "plans");
export const VendorPricing = getModel("VendorPricing", vendorPricingSchema, "vendor_pricing");
export const SupportTicket = getModel("SupportTicket", supportTicketSchema, "support_tickets");
export const Booking = getModel("Booking", bookingSchema, "bookings");
export const Recording = getModel("Recording", recordingSchema, "recordings");
export const ContactMessage = getModel("ContactMessage", contactMessageSchema, "contact_messages");
