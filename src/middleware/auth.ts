import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "../utils/apiResponse";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      vendorId: payload.vendorId ?? null,
      customerId: payload.customerId ?? null,
    };
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired access token");
  }
}

/** Use on routes that work both for logged-in and anonymous users (e.g. public event page). */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      vendorId: payload.vendorId ?? null,
      customerId: payload.customerId ?? null,
    };
  } catch {
    // Ignore invalid tokens on optional-auth routes; treat as anonymous.
  }
  next();
}
