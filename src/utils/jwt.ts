import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  vendorId?: string | null;
  customerId?: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // maps to RefreshToken.id, allows revocation
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}
