import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { users } from "@imprint/content-core/db-store";
import type { RoleType } from "@imprint/content-core";
import { db } from "@/lib/content";

/**
 * Minimal auth for /admin (UML: User + RoleType): scrypt password hashes in
 * the users table, an HMAC-signed session cookie. No external service —
 * fine for the handful of users this needs (§C: "weinig users").
 */

const COOKIE = "imprint_session";
const SESSION_HOURS = 12;

export type Session = { name: string; role: RoleType; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "change-me") {
    throw new Error("Set a real SESSION_SECRET in sites/musicbrain/.env.local");
  }
  return s;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): Session | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const got = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Check credentials against the users table; null when they don't hold. */
export async function authenticate(name: string, password: string): Promise<Session | null> {
  if (!db) throw new Error("Admin requires DATABASE_URL (the file store has no users)");
  const rows = await db.select().from(users).where(eq(users.name, name)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.hashedPassword)) return null;
  return {
    name: user.name,
    role: user.role as RoleType,
    exp: Date.now() + SESSION_HOURS * 3600_000,
  };
}

export async function createSessionCookie(session: Session): Promise<void> {
  (await cookies()).set(COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 3600,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decodeSession(token) : null;
}

/** Editors and admins may write content; readers may not (RoleType). */
export function canEdit(session: Session | null): session is Session {
  return session !== null && (session.role === "admin" || session.role === "editor");
}

/**
 * Bearer-token check for machine-to-machine writes (product-projects posting
 * content/assets). Constant-time; an unset INGEST_TOKEN disables writes.
 */
export function checkIngestToken(req: Request): boolean {
  const token = process.env.INGEST_TOKEN;
  if (!token) return false;
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
