import { createHash, randomBytes } from "node:crypto";

/**
 * Invite and claim tokens are treated as secrets. We generate a high-entropy
 * random token (>=256 bits), return the raw token to the issuer exactly once,
 * and persist only its SHA-256 hash for server-side comparison.
 */

/** Generate a URL-safe raw token (>=256 bits of entropy). */
export function generateToken(): string {
  // 32 bytes = 256 bits. base64url keeps it URL-safe and compact.
  return randomBytes(32).toString("base64url");
}

/** Deterministic SHA-256 hash (hex) of a raw token for storage/lookup. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
