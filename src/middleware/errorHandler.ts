import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiResponse";
import { env } from "../config/env";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid request data", details: err.flatten() },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: { code: "UNIQUE_CONSTRAINT", message: `Duplicate value for: ${(err.meta?.target as string[])?.join(", ")}` },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Record not found" } });
    }
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      ...(env.nodeEnv === "development" && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `No route: ${req.method} ${req.originalUrl}` } });
}
