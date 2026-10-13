import { nanoid } from "nanoid";
import { UserRole, UserStatus, OtpPurpose } from "../../types/enums";
import { User, Vendor, Customer, RefreshToken, OtpCode } from "../../models";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { sha256Hex } from "../../utils/crypto";
import { generateCode } from "../../utils/slug";
import { ApiError } from "../../utils/apiResponse";
import { env } from "../../config/env";
import { runInTransaction } from "../../utils/transaction";

function refreshExpiryDate(): Date {
  // JWT_REFRESH_EXPIRES_IN is a duration string like "30d"; keep DB expiry in sync loosely (30d default).
  const match = /^(\d+)([dhm])$/.exec(env.jwt.refreshExpiresIn);
  const amount = match ? Number(match[1]) : 30;
  const unit = match ? match[2] : "d";
  const ms = unit === "d" ? amount * 86400000 : unit === "h" ? amount * 3600000 : amount * 60000;
  return new Date(Date.now() + ms);
}

async function issueTokenPair(user: { _id: string; role: UserRole }) {
  let vendorId: string | null = null;
  let customerId: string | null = null;

  if (user.role === UserRole.VENDOR) {
    vendorId = (await Vendor.findOne({ userId: user._id }).lean())?._id ?? null;
  } else if (user.role === UserRole.CUSTOMER) {
    customerId = (await Customer.findOne({ userId: user._id }).lean())?._id ?? null;
  }

  const accessToken = signAccessToken({ sub: user._id, role: user.role, vendorId, customerId });

  // Create refresh row with a real hash up-front — Mongoose rejects empty required strings.
  const refreshRecord = new RefreshToken({
    userId: user._id,
    tokenHash: "pending",
    expiresAt: refreshExpiryDate(),
  });
  const refreshToken = signRefreshToken({ sub: user._id, jti: refreshRecord._id });
  refreshRecord.tokenHash = sha256Hex(refreshToken);
  await refreshRecord.save();

  return { accessToken, refreshToken };
}

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  vendorId: string;
}) {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict("Email already registered");

  const passwordHash = await hashPassword(input.password);

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
  });

  await Customer.create({
    userId: user._id,
    vendorId: input.vendorId,
    customerCode: generateCode("CUST"),
    name: input.name,
    phone: input.phone,
    email: input.email,
  });

  return issueTokenPair(user);
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  if (user.status !== UserStatus.ACTIVE) {
    throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}`);
  }

  user.lastLogin = new Date();
  await user.save();

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const record = await RefreshToken.findById(payload.jti);
  if (!record || record.revoked || record.userId !== payload.sub) {
    throw ApiError.unauthorized("Refresh token has been revoked");
  }
  if (record.tokenHash !== sha256Hex(refreshToken)) {
    throw ApiError.unauthorized("Refresh token mismatch");
  }
  if (record.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token expired");
  }

  // Rotate: revoke the old token, issue a new pair.
  record.revoked = true;
  await record.save();

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized();

  return issueTokenPair(user);
}

export async function logout(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await RefreshToken.updateOne({ _id: payload.jti }, { revoked: true });
  } catch {
    // Already invalid/expired — logout is idempotent either way.
  }
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email });
  if (!user) return; // Don't leak whether an email exists.

  const code = nanoid(6).toUpperCase();
  await OtpCode.create({
    userId: user._id,
    code,
    purpose: OtpPurpose.PASSWORD_RESET,
    expiresAt: new Date(Date.now() + env.otpExpiryMinutes * 60000),
  });

  // TODO: send `code` via email/SMS provider (see settings.smtp).
  return { sent: true };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await User.findOne({ email });
  if (!user) throw ApiError.badRequest("Invalid reset request");

  const otp = await OtpCode.findOne({
    userId: user._id,
    code,
    purpose: OtpPurpose.PASSWORD_RESET,
    consumed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!otp) throw ApiError.badRequest("Invalid or expired code");

  await runInTransaction(async (session) => {
    otp.consumed = true;
    await otp.save({ session });
    user.passwordHash = await hashPassword(newPassword);
    await user.save({ session });
    await RefreshToken.updateMany({ userId: user._id, revoked: false }, { revoked: true }, { session });
  });
}

export async function verifyOtp(email: string, code: string, purpose: "PHONE_VERIFY" | "EMAIL_VERIFY" | "LOGIN") {
  const user = await User.findOne({ email });
  if (!user) throw ApiError.badRequest("Invalid request");

  const otp = await OtpCode.findOne({
    userId: user._id,
    code,
    purpose,
    consumed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!otp) throw ApiError.badRequest("Invalid or expired code");

  otp.consumed = true;
  await otp.save();

  if (purpose === "EMAIL_VERIFY") {
    user.emailVerified = true;
    await user.save();
  }
  if (purpose === "PHONE_VERIFY") {
    user.phoneVerified = true;
    await user.save();
  }

  return { verified: true };
}
