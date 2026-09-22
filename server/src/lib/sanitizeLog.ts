import crypto from "crypto";

// Fields that must never appear in logs — redact with a short fingerprint hash
const REDACTED_KEYS = new Set([
  "name", "patientName", "cpf", "email", "phone", "dateOfBirth",
  "subjective", "objective", "assessment", "plan", "transcription",
  "ipAddress", "userAgent", "password", "senha", "token",
  "content", "rawJson",
]);

function fingerprint(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function maskValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (!REDACTED_KEYS.has(key)) return value;
  if (typeof value === "string" && value.length > 0) {
    return `[REDACTED:${fingerprint(value)}]`;
  }
  return "[REDACTED]";
}

/**
 * Returns a shallow copy of `data` with all PII fields replaced by
 * `[REDACTED:<hash>]`. Recurses one level deep into nested objects.
 * Use before any console.log/warn/error that may contain patient data.
 */
export function sanitizeLog(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeLog(v as Record<string, unknown>);
    } else {
      out[k] = maskValue(k, v);
    }
  }
  return out;
}
