import "express-async-errors"; // must be imported before routes so thrown async errors reach errorHandler
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import apiRoutes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true, // reflect request origin; tighten to an allow-list of vendor/admin/public frontends in production
      credentials: true,
    })
  );
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok", env: env.nodeEnv }));

  app.use("/api", apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
