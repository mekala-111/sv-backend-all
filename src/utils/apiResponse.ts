import { Response } from "express";

export function ok(res: Response, data: unknown, meta?: Record<string, unknown>) {
  return res.status(200).json({ success: true, data, meta });
}

export function created(res: Response, data: unknown) {
  return res.status(201).json({ success: true, data });
}

export function noContent(res: Response) {
  return res.status(204).send();
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "CONFLICT", message);
  }
}
