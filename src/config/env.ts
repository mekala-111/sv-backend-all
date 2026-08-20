import dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  appBaseUrl: required("APP_BASE_URL", "http://localhost:4000"),
  publicEventBaseUrl: required("PUBLIC_EVENT_BASE_URL", "http://localhost:3000"),
  vendorPanelBaseUrl: required("VENDOR_PANEL_BASE_URL", "http://localhost:3000"),

  databaseUrl: required("DATABASE_URL"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  },

  tokenEncryptionKey: required("TOKEN_ENCRYPTION_KEY"),

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
