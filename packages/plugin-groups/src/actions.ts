import { revalidatePath } from "next/cache";
import { permit, type WritableContentStore } from "@imprint/content-core";
import type { Invite, Membership, MembershipRole } from "@imprint/content-core/user-store";
import type { AdminContext, AdminSession } from "@imprint/runtime-admin";
import { notify, notifyGroup, notifyManagers, subjectFor } from "@imprint/runtime-admin/admin-server";
import { itemChanged } from "@imprint/runtime-admin";
import { getGroup } from "./groups";
import { groupHref, groupSlug } from "./href";
import { groupPosts, type GroupPost } from "./timeline";
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
  /** The visitor's user name, to recognise their own posts. */
  name: string | null;
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
  if (!ctx.session) return { signedIn: false, name: null, verified: false, membership: null, canManage: false, mode };
  const user = await ctx.users.get(ctx.session.name);
  const m = await ctx.users.membership(slug, ctx.session.name);
  return {
    signedIn: true,
    name: ctx.session.name,
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
  if (mode !== "open") {
    await notifyManagers(admin, slug, { kind: "request", title: `${user.name} wil lid worden van ${ctx.group.title}`, href: `${groupHref(slug)}/manage`, actor: user.name });
  }
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
  if (decision === "approve") {
    await ctx.users.setMembership(slug, userName, { status: "active" }, ctx.session.name);
    await notify(admin, userName, { kind: "decision", title: `Je bent toegelaten tot ${ctx.group.title}`, href: groupHref(slug), actor: ctx.session.name });
  } else {
    if (m.role === "owner") return { ok: false, error: "De eigenaar kan niet worden verwijderd." };
    await ctx.users.leave(slug, userName);
    if (m.status === "requested") {
      await notify(admin, userName, { kind: "decision", title: `Je verzoek om lid te worden van ${ctx.group.title} is niet toegekend`, href: groupHref(slug), actor: ctx.session.name });
    }
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

/** The group's timeline as this visitor may see it (a member sees the members-only posts; the page itself stays static). */
export async function posts(admin: AdminContext, slug: string): Promise<GroupPost[]> {
  const session = await admin.auth.getSession();
  const reader = session ? admin.imprint.storeFor(await subjectFor(admin, session)) : admin.imprint.store;
  return groupPosts(reader, slug);
}

// ── Members write (design/communities.md §4.3, G3a) ──────────────────────

export type PostInput = { kind: "update" | "blog"; title: string; body: string; membersOnly: boolean };

/** The pages a post shows on; stale prerendered HTML is refreshed. */
function touched(slug: string, postSlug: string) {
  for (const path of [groupHref(slug), `/blog/${postSlug}`, "/blog", `/members${groupHref(slug)}`]) revalidatePath(path);
}

/**
 * A member writes an update or a blog in their group. The PDP decides
 * ("create a post in a group you belong to"); the post is content, written
 * as the member (`by`), with the member's name as writer.
 */
export async function writePost(admin: AdminContext, slug: string, input: PostInput): Promise<ActionResult & { slug?: string }> {
  const ctx = await context(admin, slug);
  if (!ctx) return { ok: false, error: "Onbekende groep." };
  if (!ctx.session) return { ok: false, error: "Log eerst in." };
  const store = admin.imprint.writableStore!;
  if (!admin.imprint.contentTypes.has("post")) return { ok: false, error: "Deze site heeft geen berichten." };
  const title = String(input?.title ?? "").trim();
  const body = String(input?.body ?? "").trim();
  const kind = input?.kind === "blog" ? "blog" : "update";
  if (title.length < 2 || title.length > 160) return { ok: false, error: "Geef een titel van 2 tot 160 tekens." };
  if (!body || body.length > 20000) return { ok: false, error: "Schrijf een bericht (hooguit 20.000 tekens)." };
  const access = input?.membersOnly ? `group:${slug}` : "public";
  const base = `${slug}-${groupSlug(title)}`.slice(0, 100);
  let postSlug = base;
  for (let n = 2; await store.getItem("post", postSlug); n++) postSlug = `${base}-${n}`;
  const subject = await subjectFor(admin, ctx.session);
  // The policy: create in your group, as yourself (author = you); see inProcessPdp.
  const resource = { type: "post", id: postSlug, properties: { access, group: slug, author: ctx.session.name } };
  if (!(await permit(admin.imprint.pdp, subject, "create", resource))) return { ok: false, error: "Alleen leden van deze community kunnen hier schrijven." };
  await store.putItem(
    "post",
    postSlug,
    {
      slug: postSlug,
      lang: "en",
      access,
      title,
      summary: "",
      body,
      author: ctx.session.name,
      publishedAt: new Date().toISOString().slice(0, 10),
      tags: [],
      group: slug,
      kind,
    },
    { lang: "en", by: ctx.session.name }
  );
  touched(slug, postSlug);
  await notifyGroup(admin, slug, { kind: "post", title: `${ctx.session.name} schreef in ${ctx.group.title}: ${title}`, href: `/blog/${postSlug}`, actor: ctx.session.name });
  return { ok: true, slug: postSlug };
}

/** A post of the group to edit, as the visitor may see it: the fields the form needs. */
export async function post(admin: AdminContext, slug: string, postSlug: string): Promise<(PostInput & { slug: string }) | null> {
  const ctx = await context(admin, slug);
  if (!ctx) return null;
  const reader = ctx.session ? admin.imprint.storeFor(await subjectFor(admin, ctx.session)) : admin.imprint.store;
  const listing = reader as Partial<WritableContentStore>;
  if (typeof listing.getItem !== "function") return null;
  const record = await listing.getItem("post", postSlug, "en");
  const d = record?.data as { group?: string; title?: string; body?: string; kind?: string; access?: string } | undefined;
  if (!d || d.group !== slug) return null;
  return { slug: postSlug, title: d.title ?? "", body: d.body ?? "", kind: d.kind === "blog" ? "blog" : "update", membersOnly: d.access === `group:${slug}` };
}

/** Change your own post: a new version with the same slug (the history keeps the old one); the PDP decides ("own work"). */
export async function editPost(admin: AdminContext, slug: string, postSlug: string, input: PostInput): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx) return { ok: false, error: "Onbekende groep." };
  if (!ctx.session) return { ok: false, error: "Log eerst in." };
  const store = admin.imprint.writableStore!;
  const record = await store.getItem("post", postSlug, "en");
  const data = record?.data as Record<string, unknown> | undefined;
  if (!data || data.group !== slug) return { ok: false, error: "Geen bericht van deze community." };
  const title = String(input?.title ?? "").trim();
  const body = String(input?.body ?? "").trim();
  if (title.length < 2 || title.length > 160) return { ok: false, error: "Geef een titel van 2 tot 160 tekens." };
  if (!body || body.length > 20000) return { ok: false, error: "Schrijf een bericht (hooguit 20.000 tekens)." };
  const subject = await subjectFor(admin, ctx.session);
  const resource = { type: "post", id: postSlug, properties: { access: String(data.access ?? "public"), group: slug, author: String(data.author ?? "") } };
  if (!(await permit(admin.imprint.pdp, subject, "update", resource))) return { ok: false, error: "Je kunt alleen je eigen berichten bewerken." };
  await store.putItem(
    "post",
    postSlug,
    { ...data, title, body, kind: input?.kind === "blog" ? "blog" : "update", access: input?.membersOnly ? `group:${slug}` : "public" },
    { lang: "en", by: ctx.session.name }
  );
  touched(slug, postSlug);
  await itemChanged(admin, { type: "post", slug: postSlug, by: ctx.session.name });
  return { ok: true };
}

/** Remove a post from the group: your own, or any as the group's manager (the history keeps it). */
export async function removePost(admin: AdminContext, slug: string, postSlug: string): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx) return { ok: false, error: "Onbekende groep." };
  if (!ctx.session) return { ok: false, error: "Log eerst in." };
  const store = admin.imprint.writableStore!;
  const record = await store.getItem("post", postSlug);
  const data = record?.data as { group?: string; author?: string; access?: string } | undefined;
  if (!data || data.group !== slug) return { ok: false, error: "Geen bericht van deze community." };
  const subject = await subjectFor(admin, ctx.session);
  const resource = { type: "post", id: postSlug, properties: { access: data.access ?? "public", group: slug, author: data.author ?? "" } };
  if (!(await permit(admin.imprint.pdp, subject, "delete", resource))) return { ok: false, error: "Je kunt alleen je eigen berichten verwijderen." };
  await store.deleteItem("post", postSlug, "en");
  touched(slug, postSlug);
  return { ok: true };
}

export const groupsActions = { status, join, leave, members, decide, setRole, createInvite, revokeInvite, redeem, posts, post, writePost, editPost, removePost };
