import { UserRole } from "../types/enums";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  vendorId?: string | null;
  customerId?: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}

/**
 * Short-lived link that lets the owner preview an unpublished/private event page.
 * Signed with a derived secret so it can never be accepted as a login token.
 */
const PREVIEW_SECRET_SUFFIX = ":event-preview";
export const PREVIEW_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export function signEventPreviewToken(eventId: string): string {
  return jwt.sign({ eid: eventId, typ: "event-preview" }, env.jwt.accessSecret + PREVIEW_SECRET_SUFFIX, {
    expiresIn: PREVIEW_TOKEN_TTL_SECONDS,
  });
}

/** The event id the token was issued for, or null when it is missing, expired or forged. */
export function verifyEventPreviewToken(token: unknown): string | null {
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret + PREVIEW_SECRET_SUFFIX) as { eid?: string; typ?: string };
    return payload.typ === "event-preview" && payload.eid ? payload.eid : null;
  } catch {
    return null;
  }
}
