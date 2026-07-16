import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for the handful of /admin users (UML: User.hashedPassword).
 * scrypt from node's stdlib: no dependency, and memory-hard enough at these
 * numbers. Shared by the site's auth, the seed and the `npm run user` CLI, so
 * the stored format has exactly one definition.
 */

const KEYLEN = 64;
const SALT_BYTES = 16;

/** Long enough that the scrypt hash survives an offline guessing attack. */
export const MIN_PASSWORD_LENGTH = 12;

/** Stored format: scrypt:<salt-hex>:<hash-hex> */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, KEYLEN).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Why this password is unusable, or null when it passes. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

/** A strong password to hand out, for resets where nobody picks one. */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url"); // 24 chars, ~144 bits
}
