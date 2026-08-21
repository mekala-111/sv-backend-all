import { InferSchemaType } from "mongoose";
import { createSchemaNoUpdateAt, getModel } from "./base";

const refreshTokenSchema = createSchemaNoUpdateAt({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
});

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & { _id: string; id: string };
export const RefreshToken = getModel("RefreshToken", refreshTokenSchema, "refresh_tokens");
