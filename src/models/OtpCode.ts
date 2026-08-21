import { InferSchemaType } from "mongoose";
import { createSchemaNoUpdateAt, getModel } from "./base";
import { OtpPurpose } from "../types/enums";

const otpCodeSchema = createSchemaNoUpdateAt({
  userId: { type: String, required: true, index: true },
  code: { type: String, required: true },
  purpose: { type: String, enum: Object.values(OtpPurpose), required: true },
  expiresAt: { type: Date, required: true },
  consumed: { type: Boolean, default: false },
});

export type OtpCodeDoc = InferSchemaType<typeof otpCodeSchema> & { _id: string; id: string };
export const OtpCode = getModel("OtpCode", otpCodeSchema, "otp_codes");
