import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Signing/encryption keys: the dev fallbacks are public (they're in this repo), so production must set its own. */
function secret(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable in production: ${key}`);
  }
  return devFallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5161),
  appBaseUrl: required("APP_BASE_URL", "http://localhost:5161"),
  publicEventBaseUrl: required("PUBLIC_EVENT_BASE_URL", "http://localhost:3000"),
  vendorPanelBaseUrl: required("VENDOR_PANEL_BASE_URL", "http://localhost:3000"),

  mongodbUri: required(
    "MONGODB_URI",
    "mongodb+srv://venkey:<db_password>@sv-events.bmiefbg.mongodb.net/sv_live?retryWrites=true&w=majority&appName=SV-EVENTS"
  ),

  jwt: {
    accessSecret: secret("JWT_ACCESS_SECRET", "dev_access_secret_change_me_32chars_min"),
    refreshSecret: secret("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me_32chars_min"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  },

  tokenEncryptionKey: secret(
    "TOKEN_ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  ),

  /** Comma-separated browser origins allowed to call the API; empty = reflect any origin. */
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),

  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 10),

  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "ap-south-1",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID ?? "",
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
    redirectUri: process.env.YOUTUBE_REDIRECT_URI ?? "",
  },

  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "SV LIVE <no-reply@svlive.in>",
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  },
};
