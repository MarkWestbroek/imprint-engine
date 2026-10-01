import { randomBytes } from "node:crypto";
import { annotationText, permit, type AnnotationTarget, type ContentRecord, type WritableContentStore } from "@imprint/content-core";
import type { AdminContext, AdminSession } from "@imprint/runtime-admin";
import { subjectFor } from "@imprint/runtime-admin/admin-server";
import { AnnotationSchema, type Annotation, type AnnotationSetting } from "./schemas";

/**
 * The thread's actions (design/annotaties.md), through the site's plugin
 * dispatcher. Two policy enforcement points, the same question: "may this
 * subject create an annotation on this item?" decides whether the form is
 * shown (`status`) and whether a write is accepted (`add`). The plugin is the
 * PIP: it resolves the item's setting (per item, else per type, else off)
 * and the root target's access, and hands them to the PDP as properties.
 */

export type ActionResult = { ok: boolean; error?: string; slug?: string };
export type Target = { type: string; slug: string };

export type AnnotationsConfig = {
  /** Per content type: may its items be annotated, and by whom. Absent = off. */
  targets: Record<string, AnnotationSetting>;
};

export type ThreadStatus = {
  signedIn: boolean;
  name: string | null;
  /** The PEP's answer for a new annotation on this item. */
  canAnnotate: boolean;
  canModerate: boolean;
  setting: AnnotationSetting;
};

export type ThreadItem = {
  slug: string;
  author: string;
  created: string;
  motivation: string;
  text: string;
  /** Resource bodies: the asset references, for the renderer. */
  resources: string[];
  edited: boolean;
  hidden: boolean;
  /** The target changed after this annotation was made (its state is older than the current version). */
  changedSince: boolean;
  replies: ThreadItem[];
};

const isStaff = (session: AdminSession | null) => session?.role === "admin" || session?.role === "editor";

/** The item an annotation chain ends on: a non-annotation, with its record. */
async function rootOf(store: WritableContentStore, target: Target, depth = 0): Promise<{ target: Target; record: ContentRecord } | null> {
  const record = await store.getItem(target.type, target.slug, "en");
  if (!record) return null;
  if (target.type !== "annotation" || depth > 20) return { target, record };
  const parsed = AnnotationSchema.safeParse(record.data);
  const parent = parsed.success ? parsed.data.target[0]?.source : undefined;
  return parent ? rootOf(store, parent, depth + 1) : null;
}

function configOf(admin: AdminContext): AnnotationsConfig {
  const plugin = admin.plugins.find((p) => p.name === "annotations") as { config?: AnnotationsConfig } | undefined;
  return plugin?.config ?? { targets: {} };
}

/** The PIP: what the root item allows, per item (`annotations` field) else per type. */
function settingOf(admin: AdminContext, root: { target: Target; record: ContentRecord }): AnnotationSetting {
  const own = (root.record.data as { annotations?: string } | null)?.annotations;
  if (own === "off" || own === "members" || own === "public") return own;
  return configOf(admin).targets[root.target.type] ?? "off";
}

async function canModerate(admin: AdminContext, session: AdminSession | null, root: { record: ContentRecord }): Promise<boolean> {
  if (!session) return false;
  if (isStaff(session)) return true;
  const group = (root.record.data as { group?: string } | null)?.group;
  if (!group || !admin.imprint.users) return false;
  const m = await admin.imprint.users.membership(group, session.name);
  return m?.status === "active" && (m.role === "owner" || m.role === "manager");
}

async function mayCreateOn(admin: AdminContext, session: AdminSession | null, root: { target: Target; record: ContentRecord }, setting: AnnotationSetting): Promise<boolean> {
  if (!session) return false;
  const subject = await subjectFor(admin, session);
  const access = String((root.record.data as { access?: string } | null)?.access ?? "public");
  return permit(admin.imprint.pdp, subject, "create", {
    type: "annotation",
    id: "new",
    properties: { access, author: session.name, on: { access, annotations: setting } },
  });
}

async function mayRead(admin: AdminContext, session: AdminSession | null, root: { target: Target; record: ContentRecord }): Promise<boolean> {
  const subject = await subjectFor(admin, session);
  const data = root.record.data as { access?: string } | null;
  return permit(admin.imprint.pdp, subject, "read", { type: root.target.type, id: root.target.slug, properties: { access: data?.access ?? "public" } });
}

export async function status(admin: AdminContext, target: Target): Promise<ThreadStatus | null> {
  const store = admin.imprint.writableStore;
  if (!store) return null;
  const root = await rootOf(store, target);
  if (!root) return null;
  const session = await admin.auth.getSession();
  const setting = settingOf(admin, root);
  return {
    signedIn: !!session,
    name: session?.name ?? null,
    canAnnotate: setting !== "off" && (await mayCreateOn(admin, session, root, setting)),
    canModerate: await canModerate(admin, session, root),
    setting,
  };
}

/** The thread on an item: its annotations and their replies, as this visitor may see them. */
export async function list(admin: AdminContext, target: Target): Promise<ThreadItem[] | null> {
  const store = admin.imprint.writableStore;
  if (!store) return null;
  const root = await rootOf(store, target);
  if (!root) return null;
  const session = await admin.auth.getSession();
  if (!(await mayRead(admin, session, root))) return null;
  const moderator = await canModerate(admin, session, root);
  const all = (await store.listItems("annotation")).flatMap((record) => {
    const parsed = AnnotationSchema.safeParse(record.data);
    return parsed.success ? [{ record, a: parsed.data }] : [];
  });
  const currentState = root.record.txFrom.toISOString();
  const build = async (parent: Target): Promise<ThreadItem[]> => {
    const mine = all.filter(({ a }) => a.target.some((t) => t.source.type === parent.type && t.source.slug === parent.slug));
    const items: ThreadItem[] = [];
    for (const { a } of mine.sort((x, y) => x.a.created.localeCompare(y.a.created))) {
      if (a.hidden && !moderator && a.author !== session?.name) continue;
      const own = a.target.find((t) => t.source.type === parent.type && t.source.slug === parent.slug);
      const sourceDate = own?.state?.sourceDate;
      items.push({
        slug: a.slug,
        author: a.author,
        created: a.created,
        motivation: a.motivation,
        text: annotationText(a.body),
        resources: a.body.flatMap((b) => (b.type === "Resource" ? [b.source] : [])),
        edited: a.edited,
        hidden: a.hidden,
        changedSince: parent.type !== "annotation" && !!sourceDate && sourceDate < currentState,
        replies: await build({ type: "annotation", slug: a.slug }),
      });
    }
    return items;
  };
  return build(target);
}

/** Write an annotation on an item, as the signed-in member; a reply is one whose target is an annotation. */
export async function add(admin: AdminContext, target: Target, text: string, motivation?: string): Promise<ActionResult> {
  const store = admin.imprint.writableStore;
  if (!store) return { ok: false, error: "Reageren kan alleen met een database." };
  const session = await admin.auth.getSession();
  if (!session) return { ok: false, error: "Log eerst in." };
  const root = await rootOf(store, target);
  if (!root) return { ok: false, error: "Onbekend onderwerp." };
  const body = String(text ?? "").trim();
  if (!body || body.length > 20000) return { ok: false, error: "Schrijf een reactie (hooguit 20.000 tekens)." };
  const setting = settingOf(admin, root);
  if (setting === "off" || !(await mayCreateOn(admin, session, root, setting))) return { ok: false, error: "Reageren is hier niet mogelijk." };
  const user = admin.imprint.users ? await admin.imprint.users.get(session.name) : null;
  if (!isStaff(session) && user && !user.emailVerified) return { ok: false, error: "Bevestig eerst je e-mailadres." };
  const parent = await store.getItem(target.type, target.slug, "en");
  if (!parent) return { ok: false, error: "Onbekend onderwerp." };
  const now = new Date();
  const slug = `anno-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex")}`;
  const annotation: Annotation = {
    slug,
    lang: "en",
    author: session.name,
    created: now.toISOString(),
    motivation: target.type === "annotation" ? "replying" : motivation === "questioning" ? "questioning" : "commenting",
    target: [{ source: target, field: "", selector: [], state: { type: "TimeState", sourceDate: parent.txFrom.toISOString() } }],
    body: [{ type: "TextualBody", value: body, format: "text/markdown" }],
    edited: false,
    hidden: false,
    hiddenBy: "",
  };
  await store.putItem("annotation", slug, annotation, { lang: "en", by: session.name });
  return { ok: true, slug };
}

async function own(admin: AdminContext, slug: string): Promise<{ store: WritableContentStore; session: AdminSession; a: Annotation; record: ContentRecord } | ActionResult> {
  const store = admin.imprint.writableStore;
  if (!store) return { ok: false, error: "Geen database." };
  const session = await admin.auth.getSession();
  if (!session) return { ok: false, error: "Log eerst in." };
  const record = await store.getItem("annotation", slug, "en");
  const parsed = record ? AnnotationSchema.safeParse(record.data) : null;
  if (!record || !parsed?.success) return { ok: false, error: "Onbekende reactie." };
  return { store, session, a: parsed.data, record };
}

/** Change your own annotation: a new version (the thread marks it "bewerkt"). */
export async function edit(admin: AdminContext, slug: string, text: string): Promise<ActionResult> {
  const got = await own(admin, slug);
  if ("ok" in got) return got;
  const body = String(text ?? "").trim();
  if (!body || body.length > 20000) return { ok: false, error: "Schrijf een reactie (hooguit 20.000 tekens)." };
  const subject = await subjectFor(admin, got.session);
  if (!(await permit(admin.imprint.pdp, subject, "update", { type: "annotation", id: slug, properties: { access: "public", author: got.a.author } }))) {
    return { ok: false, error: "Je kunt alleen je eigen reacties bewerken." };
  }
  const bodies = got.a.body.some((b) => b.type === "TextualBody")
    ? got.a.body.map((b) => (b.type === "TextualBody" ? { ...b, value: body } : b))
    : [...got.a.body, { type: "TextualBody" as const, value: body, format: "text/markdown" as const }];
  await got.store.putItem("annotation", slug, { ...got.a, body: bodies, edited: true }, { lang: "en", by: got.session.name });
  return { ok: true };
}

/** Remove your own annotation (a tombstone; its replies stay in history but become unreachable). */
export async function remove(admin: AdminContext, slug: string): Promise<ActionResult> {
  const got = await own(admin, slug);
  if ("ok" in got) return got;
  const subject = await subjectFor(admin, got.session);
  if (!(await permit(admin.imprint.pdp, subject, "delete", { type: "annotation", id: slug, properties: { access: "public", author: got.a.author } }))) {
    return { ok: false, error: "Je kunt alleen je eigen reacties verwijderen." };
  }
  await got.store.deleteItem("annotation", slug, "en");
  return { ok: true };
}

/** A moderator hides (or shows again) an annotation: a version, so the history keeps what was said. */
export async function hide(admin: AdminContext, slug: string, hidden: boolean): Promise<ActionResult> {
  const got = await own(admin, slug);
  if ("ok" in got) return got;
  const root = got.a.target[0] ? await rootOf(got.store, got.a.target[0].source) : null;
  if (!root || !(await canModerate(admin, got.session, root))) return { ok: false, error: "Alleen beheerders kunnen reacties verbergen." };
  await got.store.putItem("annotation", slug, { ...got.a, hidden, hiddenBy: hidden ? got.session.name : "" }, { lang: "en", by: got.session.name });
  return { ok: true };
}

/** The earlier versions of an annotation, for whoever may read its thread. */
export async function history(admin: AdminContext, slug: string): Promise<{ at: string; text: string; by: string | null }[] | null> {
  const store = admin.imprint.writableStore;
  if (!store) return null;
  const record = await store.getItem("annotation", slug, "en");
  const parsed = record ? AnnotationSchema.safeParse(record.data) : null;
  if (!record || !parsed?.success || !parsed.data.target[0]) return null;
  const root = await rootOf(store, parsed.data.target[0].source);
  if (!root || !(await mayRead(admin, await admin.auth.getSession(), root))) return null;
  return (await store.listVersions("annotation", slug, "en")).map((v) => {
    const a = AnnotationSchema.safeParse(v.data);
    return { at: v.txFrom.toISOString(), text: a.success ? annotationText(a.data.body) : "", by: v.createdBy };
  });
}

export const annotationsActions = { status, list, add, edit, remove, hide, history };
