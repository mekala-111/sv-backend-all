import { UserRole, UserStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "../../config/prisma";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { sha256Hex } from "../../utils/crypto";
import { generateCode } from "../../utils/slug";
import { ApiError } from "../../utils/apiResponse";
import { env } from "../../config/env";

function refreshExpiryDate(): Date {
  // JWT_REFRESH_EXPIRES_IN is a duration string like "30d"; keep DB expiry in sync loosely (30d default).
  const match = /^(\d+)([dhm])$/.exec(env.jwt.refreshExpiresIn);
  const amount = match ? Number(match[1]) : 30;
  const unit = match ? match[2] : "d";
  const ms = unit === "d" ? amount * 86400000 : unit === "h" ? amount * 3600000 : amount * 60000;
  return new Date(Date.now() + ms);
}

async function issueTokenPair(user: { id: string; role: UserRole }) {
  let vendorId: string | null = null;
  let customerId: string | null = null;

  if (user.role === UserRole.VENDOR) {
    vendorId = (await prisma.vendor.findUnique({ where: { userId: user.id } }))?.id ?? null;
  } else if (user.role === UserRole.CUSTOMER) {
    customerId = (await prisma.customer.findUnique({ where: { userId: user.id } }))?.id ?? null;
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, vendorId, customerId });

  const refreshRecord = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: "", // set below once we have the jti-bound token
      expiresAt: refreshExpiryDate(),
    },
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti: refreshRecord.id });
  await prisma.refreshToken.update({
    where: { id: refreshRecord.id },
    data: { tokenHash: sha256Hex(refreshToken) },
  });

  return { accessToken, refreshToken };
}

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  vendorId: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict("Email already registered");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.customer.create({
    data: {
      userId: user.id,
      vendorId: input.vendorId,
      customerCode: generateCode("CUST"),
      name: input.name,
      phone: input.phone,
      email: input.email,
    },
  });

  return issueTokenPair(user);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  if (user.status !== UserStatus.ACTIVE) {
    throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

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

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
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
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized();

  return issueTokenPair(user);
}

export async function logout(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({ where: { id: payload.jti }, data: { revoked: true } });
  } catch {
    // Already invalid/expired — logout is idempotent either way.
  }
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Don't leak whether an email exists.

  const code = nanoid(6).toUpperCase();
  await prisma.otpCode.create({
    data: {
      userId: user.id,
      code,
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + env.otpExpiryMinutes * 60000),
    },
  });

  // TODO: send `code` via email/SMS provider (see settings.smtp).
  return { sent: true };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.badRequest("Invalid reset request");

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, code, purpose: "PASSWORD_RESET", consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw ApiError.badRequest("Invalid or expired code");

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } }),
  ]);
}

export async function verifyOtp(email: string, code: string, purpose: "PHONE_VERIFY" | "EMAIL_VERIFY" | "LOGIN") {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.badRequest("Invalid request");

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, code, purpose, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw ApiError.badRequest("Invalid or expired code");

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  if (purpose === "EMAIL_VERIFY") await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  if (purpose === "PHONE_VERIFY") await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });

  return { verified: true };
}
