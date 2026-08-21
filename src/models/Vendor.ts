import { InferSchemaType } from "mongoose";
import { createSchema, getModel } from "./base";
import { VendorStatus } from "../types/enums";

const vendorSchema = createSchema({
  userId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  vendorCode: { type: String, required: true, unique: true },
  logo: { type: String, default: null },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  address: { type: String, default: null },
  status: { type: String, enum: Object.values(VendorStatus), default: VendorStatus.PENDING_APPROVAL },
  planId: { type: String, default: null },
  /** INR fee charged to the vendor each time they create an event. 0 = free. */
  eventCreationFee: { type: Number, default: 0 },
  whatsappNumber: { type: String, default: null },
  whatsappEnabled: { type: Boolean, default: false },
  branding: {
    type: {
      primaryColor: String,
      secondaryColor: String,
      accentColor: String,
      logo: String,
      favicon: String,
      customDomain: String,
      supportEmail: String,
    },
    default: {},
  },
});

vendorSchema.index({ status: 1 });

export type VendorDoc = InferSchemaType<typeof vendorSchema> & { _id: string; id: string };
export const Vendor = getModel("Vendor", vendorSchema, "vendors");
