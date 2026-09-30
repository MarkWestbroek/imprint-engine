import type { Invite, Membership, MembershipRole } from "@imprint/content-core/user-store";
import type { AdminContext, AdminSession } from "@imprint/runtime-admin";
import { getGroup } from "./groups";
import { groupHref } from "./href";
import type { Group } from "./schemas";

/**
 * The group actions (design/communities.md §4.1–4.2, G1), run through the
 * site's plugin dispatcher: joining and leaving, the manager's decisions,
 * invitation links. Each one checks the session itself. Membership is
 * personal data and lives in the user store, not in content.
 */

export type ActionResult = { ok: boolean; error?: string };

/** How one joins: straight away, after the manager's approval, or not at all (invitation only). */
export type JoinMode = "open" | "request" | "closed";

export type JoinStatus = {
  signedIn: boolean;
  /** Registered members join only with a verified address; admins and editors always may. */
  verified: boolean;
  membership: { role: MembershipRole; status: Membership["status"] } | null;
  canManage: boolean;
  mode: JoinMode;
};

export type MemberList = {
  members: Membership[];
  invites: Invite[];
  /** The site's public address, to make invitation links absolute. */
  baseUrl: string;
};

type Ctx = { session: AdminSession | null; users: NonNullable<AdminContext["imprint"]["users"]>; group: Group };

async function context(admin: AdminContext, slug: string): Promise<Ctx | null> {
  const users = admin.imprint.users;
  const store = admin.imprint.writableStore;
  if (!users || !store) return null;
  const group = await getGroup(store, slug);
  if (!group) return null;
  return { session: await admin.auth.getSession(), users, group };
}

const isStaff = (session: AdminSession | null) => session?.role === "admin" || session?.role === "editor";

async function canManage(ctx: Ctx): Promise<boolean> {
  if (!ctx.session) return false;
  if (isStaff(ctx.session)) return true;
  const m = await ctx.users.membership(ctx.group.slug, ctx.session.name);
  return m?.status === "active" && (m.role === "owner" || m.role === "manager");
}

const modeOf = (group: Group): JoinMode => (group.membershipOnRequest ? "request" : "open");

export async function status(admin: AdminContext, slug: string): Promise<JoinStatus | null> {
  const ctx = await context(admin, slug);
  if (!ctx) return null;
  const mode = modeOf(ctx.group);
  if (!ctx.session) return { signedIn: false, verified: false, membership: null, canManage: false, mode };
  const user = await ctx.users.get(ctx.session.name);
  const m = await ctx.users.membership(slug, ctx.session.name);
  return {
    signedIn: true,
    verified: isStaff(ctx.session) || (user?.emailVerified ?? false),
    membership: m ? { role: m.role, status: m.status } : null,
    canManage: await canManage(ctx),
    mode,
  };
}

export async function join(admin: AdminContext, slug: string): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx) return { ok: false, error: "Onbekende groep." };
  if (!ctx.session) return { ok: false, error: "Log eerst in." };
  const user = await ctx.users.get(ctx.session.name);
  if (!user) return { ok: false, error: "Onbekende gebruiker." };
  if (!isStaff(ctx.session) && !user.emailVerified) return { ok: false, error: "Bevestig eerst je e-mailadres." };
  const mode = modeOf(ctx.group);
  if (mode === "closed") return { ok: false, error: "Deze groep is alleen op uitnodiging." };
  await ctx.users.join(slug, user.name, { status: mode === "open" ? "active" : "requested" });
  return { ok: true };
}

export async function leave(admin: AdminContext, slug: string): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx?.session) return { ok: false, error: "Log eerst in." };
  const m = await ctx.users.membership(slug, ctx.session.name);
  if (m?.role === "owner") return { ok: false, error: "De eigenaar kan de groep niet verlaten; draag het eigenaarschap eerst over." };
  await ctx.users.leave(slug, ctx.session.name);
  return { ok: true };
}

/** The members and invitation links of a group; managers only. */
export async function members(admin: AdminContext, slug: string): Promise<MemberList | null> {
  const ctx = await context(admin, slug);
  if (!ctx || !(await canManage(ctx))) return null;
  const site = await admin.imprint.store.getSiteConfig();
  return { members: await ctx.users.membersOf(slug), invites: await ctx.users.invitesOf(slug), baseUrl: site.baseUrl };
}

export async function decide(
  admin: AdminContext,
  slug: string,
  userName: string,
  decision: "approve" | "reject" | "remove"
): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx?.session || !(await canManage(ctx))) return { ok: false, error: "Alleen beheerders van de groep." };
  const m = await ctx.users.membership(slug, userName);
  if (!m) return { ok: false, error: "Geen lid." };
  if (decision === "approve") await ctx.users.setMembership(slug, userName, { status: "active" }, ctx.session.name);
  else {
    if (m.role === "owner") return { ok: false, error: "De eigenaar kan niet worden verwijderd." };
    await ctx.users.leave(slug, userName);
  }
  return { ok: true };
}

export async function setRole(admin: AdminContext, slug: string, userName: string, role: MembershipRole): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx?.session || !(await canManage(ctx))) return { ok: false, error: "Alleen beheerders van de groep." };
  if (role === "owner" && !isStaff(ctx.session)) {
    const me = await ctx.users.membership(slug, ctx.session.name);
    if (me?.role !== "owner") return { ok: false, error: "Alleen de eigenaar kan het eigenaarschap overdragen." };
  }
  await ctx.users.setMembership(slug, userName, { role }, ctx.session.name);
  return { ok: true };
}

/** An invitation link, valid 30 days: whoever opens it and signs in joins with `role`. */
export async function createInvite(admin: AdminContext, slug: string, role: MembershipRole): Promise<ActionResult & { url?: string }> {
  const ctx = await context(admin, slug);
  if (!ctx?.session || !(await canManage(ctx))) return { ok: false, error: "Alleen beheerders van de groep." };
  const code = await ctx.users.createInvite(slug, role === "owner" ? "manager" : role, ctx.session.name, 30);
  const site = await admin.imprint.store.getSiteConfig();
  return { ok: true, url: `${site.baseUrl.replace(/\/$/, "")}${groupHref(slug)}/join/${code}` };
}

export async function revokeInvite(admin: AdminContext, slug: string, id: number): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx?.session || !(await canManage(ctx))) return { ok: false, error: "Alleen beheerders van de groep." };
  await ctx.users.revokeInvite(slug, id);
  return { ok: true };
}

/** Open an invitation link while signed in: an active membership. */
export async function redeem(admin: AdminContext, slug: string, code: string): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx) return { ok: false, error: "Onbekende groep." };
  if (!ctx.session) return { ok: false, error: "Log eerst in." };
  const m = await ctx.users.redeemInvite(code, ctx.session.name);
  if (!m || m.groupSlug !== slug) return { ok: false, error: "Deze uitnodiging is onbekend of verlopen." };
  return { ok: true };
}

export const groupsActions = { status, join, leave, members, decide, setRole, createInvite, revokeInvite, redeem };
