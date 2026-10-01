import type { Digest, Notification, UserRecord } from "@imprint/content-core/user-store";
import type { AdminContext } from "../admin-context";

/**
 * The mail digest (design/communities.md §4.4, G3c step 2): what the inbox
 * collected since the last run, one mail per member, sent by a scheduled
 * call to `POST /api/digest` (deploy.sh digest <site>, from cron). Quiet
 * communities, no mail per event. A member without a verified address, or
 * who said "off", gets nothing — their notifications are still marked as
 * mailed, so a change of mind starts fresh instead of with a backlog. Every
 * mail carries a one-click unsubscribe link (a one-time token, 30 days).
 */

export type DigestItem = Pick<Notification, "title" | "href" | "createdAt">;

/** The text of one member's digest; pure, so it is testable. */
export function composeDigest(opts: { siteName: string; baseUrl: string; user: Pick<UserRecord, "name">; items: DigestItem[]; inboxPath: string; unsubscribeUrl: string }): { subject: string; text: string } {
  const base = opts.baseUrl.replace(/\/$/, "");
  const n = opts.items.length;
  const lines = opts.items.map((i) => `- ${i.title}\n  ${base}${i.href}`);
  return {
    subject: `${opts.siteName}: ${n === 1 ? "1 nieuwe mededeling" : `${n} nieuwe mededelingen`}`,
    text:
      `Hallo ${opts.user.name},\n\nDit gebeurde sinds de vorige mail:\n\n${lines.join("\n")}\n\n` +
      `Alle mededelingen: ${base}${opts.inboxPath}\n\n` +
      `Geen mail meer ontvangen? ${opts.unsubscribeUrl}\n` +
      `(de mededelingen op de site blijven; dit zet alleen de dagelijkse mail uit)\n`,
  };
}

export type DigestReport = { mailed: number; skipped: number; items: number; dryRun?: boolean };

/** Send what is pending: one mail per member; returns the counts. Without a mailer nothing is sent or marked. */
export async function sendDigests(admin: Pick<AdminContext, "imprint">, opts: { baseUrl: string; inboxPath?: string; dryRun?: boolean } ): Promise<DigestReport> {
  const users = admin.imprint.users;
  const mailer = admin.imprint.mail;
  if (!users) return { mailed: 0, skipped: 0, items: 0 };
  const pending = await users.unmailedNotifications();
  const byUser = new Map<string, Notification[]>();
  for (const n of pending) byUser.set(n.userName, [...(byUser.get(n.userName) ?? []), n]);
  const site = await admin.imprint.store.getSiteConfig();
  const base = opts.baseUrl.replace(/\/$/, "");
  const inboxPath = opts.inboxPath ?? "/account/notifications";
  let mailed = 0;
  let skipped = 0;
  for (const [name, items] of byUser) {
    const user = await users.get(name);
    const wants = !!user?.email && user.emailVerified && user.digest !== "off" && !!mailer;
    if (!wants) {
      skipped++;
      if (!opts.dryRun && user) await users.markMailedNotifications(items.map((i) => i.id));
      continue;
    }
    const token = await users.createEmailToken(name, "digest-off", 24 * 30);
    const unsubscribeUrl = `${base}/account/digest?token=${encodeURIComponent(token)}`;
    const mail = composeDigest({ siteName: site.name, baseUrl: base, user: user!, items, inboxPath, unsubscribeUrl });
    if (!opts.dryRun) {
      await mailer!.send({ to: user!.email!, ...mail });
      await users.markMailedNotifications(items.map((i) => i.id));
    }
    mailed++;
  }
  return { mailed, skipped, items: pending.length, ...(opts.dryRun ? { dryRun: true } : {}) };
}

/** The route handler for `POST /api/digest`: the site's ingest token, as a scheduled job's credential. */
export async function digestApi(admin: AdminContext, req: Request): Promise<Response> {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
  const secret = admin.imprint.secrets.ingestToken;
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!secret || !m || m[1] !== secret) return Response.json({ error: "Missing or invalid token" }, { status: 401 });
  const site = await admin.imprint.store.getSiteConfig();
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const report = await sendDigests(admin, { baseUrl: site.baseUrl, dryRun });
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}

/** The signed-in member sets their digest preference. */
export async function setDigestPreference(admin: AdminContext, digest: Digest): Promise<{ ok: boolean; error?: string }> {
  const session = await admin.auth.getSession();
  const users = admin.imprint.users;
  if (!session || !users) return { ok: false, error: "Log eerst in." };
  await users.setDigest(session.name, digest === "off" ? "off" : "daily");
  return { ok: true };
}

/** The unsubscribe link from a mail: no login needed, the token names the member. */
export async function digestOffByToken(admin: Pick<AdminContext, "imprint">, token: string): Promise<UserRecord | null> {
  const users = admin.imprint.users;
  if (!users || !token) return null;
  const user = await users.consumeEmailToken(token, "digest-off");
  if (user) await users.setDigest(user.name, "off");
  return user;
}
