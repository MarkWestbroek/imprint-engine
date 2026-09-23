import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserStore } from "@imprint/content-core/user-store";
import type { RoleType } from "@imprint/content-core";
import { imprint } from "@/lib/content";
import { authorize } from "./authorize";

/**
 * Minimal auth for /admin (UML: User + RoleType): scrypt password hashes in
 * the users table, an HMAC-signed session cookie. No external service —
 * fine for the handful of users this needs (§C: "weinig users").
 */

// Per instance (imprint.config.ts): cookie name and session length.
const COOKIE = imprint.session.cookie;
const SESSION_HOURS = imprint.session.hours;

/** User CRUD for /admin/users. Null in file mode: v0 has no users table. */
export const userStore: UserStore | null = imprint.users;

export type Session = { name: string; role: RoleType; exp: number };

function secret(): string {
  const s = imprint.secrets.session;
  if (!s || s === "change-me") {
    throw new Error("Set a real SESSION_SECRET in sites/musicbrain/.env.local");
  }
  return s;
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
  if (!userStore) {
    throw new Error("Admin requires DATABASE_URL (the file store has no users)");
  }
  const user = await userStore.verify(name, password);
  if (!user) return null;
  return { name: user.name, role: user.role, exp: Date.now() + SESSION_HOURS * 3600_000 };
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

/**
 * Editors and admins may write content; readers may not (RoleType).
 * Thin wrapper over the PEP (`authorize`, lib/authorize.ts) so every
 * write-check flows through the same gate — design/fase-3 §4.
 */
export async function canEdit(session: Session | null): Promise<boolean> {
  return session !== null && (await authorize(session, "update", { type: "*", id: "*" }));
}

/** The session, when it may edit; null otherwise. What every admin action starts with. */
export async function editingSession(): Promise<Session | null> {
  const session = await getSession();
  return (await canEdit(session)) ? session : null;
}

/**
 * Bearer-token check for machine-to-machine writes (product-projects posting
 * content/assets). Constant-time; an unset INGEST_TOKEN disables writes.
 */
export function checkIngestToken(req: Request): boolean {
  const token = imprint.secrets.ingestToken;
  if (!token) return false;
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
