import crypto from "crypto";
import { env } from "../config/env";

// TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) — see .env.example.
const KEY = Buffer.from(env.tokenEncryptionKey, "hex");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

if (KEY.length !== 32) {
  // Fail fast in any environment where the key isn't a valid 32-byte key,
  // since silently encrypting with a bad key would corrupt stored secrets.
  throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
}

/** Encrypts a secret (e.g. YouTube OAuth access/refresh token) for DB storage. */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64-encoded.
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
