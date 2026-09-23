import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { permit, userSubject, type RoleType } from "@imprint/content-core";
import type { ImprintInstance } from "@imprint/extension-api";
import type { AdminAuth, AdminSession } from "../admin-context";

/**
 * Minimal auth for /admin (UML: User + RoleType): scrypt password hashes in
 * the users table (the instance's `users`), an HMAC-signed session cookie
 * named and timed by the instance (`session.cookie`, `session.hours`), signed
 * with `secrets.session`. No external service — fine for the handful of
 * users this needs (§C: "weinig users"). Stateless, so a reset or role
 * change does not reach other browsers until the cookie expires (backlog:
 * sessies intrekbaar).
 *
 * `createSessionAuth(imprint)` is what a site puts in its AdminContext.
 */

type Token = AdminSession & { exp: number };

export interface SessionAuth extends AdminAuth {
  /** May this session write content? Readers may not (RoleType); the PEP decides. */
  canEdit(session: AdminSession | null): Promise<boolean>;
}

export function createSessionAuth(imprint: ImprintInstance): SessionAuth {
  const COOKIE = imprint.session.cookie;
  const HOURS = imprint.session.hours;

  function secret(): string {
    const s = imprint.secrets.session;
    if (!s || s === "change-me") {
      throw new Error(`Set a real SESSION_SECRET for instance "${imprint.id}" (see .env.example)`);
    }
    return s;
  }

  const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

  function encode(token: Token): string {
    const payload = Buffer.from(JSON.stringify(token)).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function decode(value: string): AdminSession | null {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    const got = Buffer.from(signature);
    const want = Buffer.from(sign(payload));
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
    try {
      const token = JSON.parse(Buffer.from(payload, "base64url").toString()) as Token;
      if (token.exp < Date.now()) return null;
      return { name: token.name, role: token.role as RoleType };
    } catch {
      return null;
    }
  }

  async function getSession(): Promise<AdminSession | null> {
    const value = (await cookies()).get(COOKIE)?.value;
    return value ? decode(value) : null;
  }

  async function canEdit(session: AdminSession | null): Promise<boolean> {
    if (!session) return false;
    return permit(imprint.pdp, userSubject(session.name, session.role), "update", {
      type: "*",
      id: "*",
      properties: {},
    });
  }

  return {
    getSession,
    canEdit,
    async editingSession() {
      const session = await getSession();
      return (await canEdit(session)) ? session : null;
    },
    async signIn(name, password) {
      const users = imprint.users;
      if (!users) throw new Error("Admin requires DATABASE_URL (the file store has no users)");
      const user = await users.verify(name, password);
      if (!user) return null;
      const session: AdminSession = { name: user.name, role: user.role };
      (await cookies()).set(COOKIE, encode({ ...session, exp: Date.now() + HOURS * 3600_000 }), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: HOURS * 3600,
        path: "/",
      });
      return session;
    },
    async signOut() {
      (await cookies()).delete(COOKIE);
    },
  };
}
