import { redirect } from "next/navigation";
import type { Membership, UserRecord } from "@imprint/content-core/user-store";
import type { AdminContext } from "../admin-context";

/** Same shape as the admin actions' ActionResult. */
type ActionResult = { ok: boolean; error?: string };

/**
 * Members of a site (design/communities.md §4.1, G1): self-registration with
 * an e-mail address, verification by a one-time mail link, signing in on the
 * public site, and the profile. The site wraps these in "use server"
 * actions and routes, as with the admin's actions.
 *
 * Registration is where spam arrives: a honeypot field (`website`, hidden;
 * a bot fills it in) and a small per-IP rate limit. Both belong to the form,
 * not to the mail (design/mail.md, rule 4).
 */

export type RegisterResult = ActionResult & {
  /** Without a mailer, outside production: the link is shown instead of mailed. */
  verifyUrl?: string;
};

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** A path on this site to come back to after signing in; anything else falls back. */
export function localPath(value: unknown, fallback: string): string {
  const s = String(value ?? "");
  return /^\/(?!\/)[^\s]*$/.test(s) ? s : fallback;
}

export async function registerMember(
  admin: AdminContext,
  input: { name: string; email: string; password: string; website?: string },
  opts: { ip?: string; baseUrl: string }
): Promise<RegisterResult> {
  const users = admin.imprint.users;
  if (!users) return { ok: false, error: "Registreren kan alleen met een database (DATABASE_URL)." };
  // The honeypot: a real visitor never sees the field, so a value means a bot. Pretend it worked.
  if (input.website) return { ok: true };
  if (opts.ip && rateLimited(opts.ip)) return { ok: false, error: "Te veel pogingen; probeer het over tien minuten nog eens." };
  let user: UserRecord;
  try {
    user = await users.register(input.name.trim(), input.email, input.password);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  return sendVerification(admin, user.name, opts.baseUrl);
}

/** Mail the verification link; without a mailer the link comes back (dev) or an error (production). */
export async function sendVerification(admin: AdminContext, userName: string, baseUrl: string): Promise<RegisterResult> {
  const users = admin.imprint.users!;
  const user = await users.get(userName);
  if (!user?.email) return { ok: false, error: "Geen e-mailadres bekend." };
  const token = await users.createEmailToken(user.name, "verify");
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/account/verify?token=${encodeURIComponent(token)}`;
  const mailer = admin.imprint.mail;
  if (!mailer) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Mail is op deze site nog niet ingesteld; vraag de beheerder je adres te bevestigen." };
    }
    console.info(`[members] no mailer configured; verification link for ${user.name}: ${verifyUrl}`);
    return { ok: true, verifyUrl };
  }
  const site = await admin.imprint.store.getSiteConfig();
  await mailer.send({
    to: user.email,
    subject: `Bevestig je e-mailadres voor ${site.name}`,
    text:
      `Hallo ${user.name},\n\nBevestig je e-mailadres voor ${site.name} met deze link (24 uur geldig):\n\n${verifyUrl}\n\n` +
      `Heb je je niet aangemeld? Dan kun je dit bericht negeren.\n`,
  });
  return { ok: true };
}

/** The user behind a verification token, now verified; null when the link is stale. */
export async function confirmEmail(admin: AdminContext, token: string): Promise<UserRecord | null> {
  const users = admin.imprint.users;
  if (!users || !token) return null;
  return users.consumeEmailToken(token, "verify");
}

/** Sign in on the public site (name or e-mail address) and go back to where the visitor was. */
export async function signInMember(admin: AdminContext, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const session = await admin.auth.signIn(identifier, password);
  if (!session) return { ok: false, error: "Onbekende combinatie van naam of e-mailadres en wachtwoord." };
  redirect(localPath(formData.get("next"), "/account"));
}

export async function signOutMember(admin: AdminContext, to = "/"): Promise<void> {
  await admin.auth.signOut();
  redirect(localPath(to, "/"));
}

export type MemberProfile = { user: UserRecord; memberships: Membership[]; canEdit: boolean };

/** The signed-in member's profile, or null when nobody is signed in. */
export async function memberProfile(admin: AdminContext): Promise<MemberProfile | null> {
  const session = await admin.auth.getSession();
  const users = admin.imprint.users;
  if (!session || !users) return null;
  const user = await users.get(session.name);
  if (!user) return null;
  return { user, memberships: await users.membershipsOf(user.name), canEdit: (await admin.auth.editingSession()) !== null };
}
