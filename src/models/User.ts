import { InferSchemaType } from "mongoose";
import { createSchema, getModel } from "./base";
import { UserRole, UserStatus } from "../types/enums";

const userSchema = createSchema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), required: true },
  status: { type: String, enum: Object.values(UserStatus), default: UserStatus.PENDING },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, default: null },
});

userSchema.index({ role: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string; id: string };
export const User = getModel("User", userSchema, "users");
