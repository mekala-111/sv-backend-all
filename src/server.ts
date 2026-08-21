import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./config/mongo";

async function main() {
  await connectMongo();
  const app = createApp();

  const server = app.listen(env.port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`SV LIVE backend listening on port ${env.port} [${env.nodeEnv}]`);
  });

  async function shutdown(signal: string) {
    // eslint-disable-next-line no-console
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
