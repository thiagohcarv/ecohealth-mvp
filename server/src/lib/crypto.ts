import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — GCM recommended
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env["ENCRYPTION_KEY"] ?? "";
  if (raw.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  // Derive a fixed 256-bit key from the env string
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a UTF-8 string with AES-256-GCM.
 * Output format (base64): iv(12) || authTag(16) || ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64");
}

/**
 * Decrypts a value produced by encrypt().
 * Throws on tampered or malformed ciphertext (GCM auth tag mismatch).
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** Encrypts only if value is non-empty; returns null otherwise. */
export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Decrypts only if value is non-empty.
 * Falls back to the original value when decryption fails — handles
 * pre-encryption data already in the DB without a separate migration.
 */
export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return value; // pre-encryption plaintext — return as-is
  }
}
