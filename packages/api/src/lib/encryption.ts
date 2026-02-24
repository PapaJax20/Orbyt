import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM
// INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars) in env.
// Format stored: iv:authTag:ciphertext (all hex)
// ---------------------------------------------------------------------------

export function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) throw new Error("INTEGRATION_ENCRYPTION_KEY not configured");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return buf;
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const key = getEncryptionKey();
  const parts = data.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted data format");
  const [ivHex, authTagHex, cipherHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
