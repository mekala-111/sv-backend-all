import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Reuse a single PrismaClient instance across the app (and across ts-node-dev
// hot reloads in development) to avoid exhausting DB connections.
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (env.nodeEnv !== "production") {
  global.__prisma__ = prisma;
}
