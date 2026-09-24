import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RelationsDoc, type ContentType, type RelationRule } from "@imprint/content-core";
import type { ActionResult, StudioActions, UserAction, UserActions } from "../admin/types";
import type { AdminContext } from "../admin-context";

/**
 * The admin's server actions, minus the `"use server"` directive: a site
 * exports each from its own `"use server"` module as a one-line wrapper that
 * passes its `AdminContext` (see the site's app/admin/actions.ts). That keeps
 * the actions in one place for every site while Next still registers them
 * where a route can reach them.
 *
 * Every action starts with the session and answers with an `ActionResult`
 * for `useActionState`, or redirects (a plain form action).
 */

export async function signIn(admin: AdminContext, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const session = await admin.auth.signIn(name, password);
  if (!session) return { ok: false, error: "Wrong username or password" };
  redirect("/admin");
}

export async function signOut(admin: AdminContext): Promise<void> {
  await admin.auth.signOut();
  redirect("/admin");
}

/** An untrusted type name (form field, URL) → an active, listable type, or an error. */
export function parseType(admin: AdminContext, value: unknown): ContentType {
  const type = String(value);
  if (!admin.imprint.contentTypes.has(type, "listable")) throw new Error(`Unknown content type "${type}"`);
  return type;
}

/** The natural key lives inside the data, per type (UML: ContentItem /type). */
export function slugFor(type: ContentType, data: Record<string, unknown>): string {
  switch (type) {
    case "site":
      return "site";
    case "menu":
    case "theme":
      return String(data.name ?? "");
    case "release":
      return `${String(data.project ?? "")}-${String(data.version ?? "")}`;
    default:
      return String(data.slug ?? "");
  }
}

export async function saveItem(admin: AdminContext, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await admin.auth.editingSession();
  if (!session) return { ok: false, error: "Not signed in" };
  const store = admin.imprint.writableStore;
  if (!store) return { ok: false, error: "Editing requires DATABASE_URL" };

  try {
    const type = parseType(admin, formData.get("type"));
    const data = JSON.parse(String(formData.get("data") ?? "{}")) as Record<string, unknown>;
    const slug = slugFor(type, data);
    if (!slug || slug === "-") return { ok: false, error: "Item needs a slug/name" };

    const validFromRaw = String(formData.get("validFrom") ?? "");
    const validToRaw = String(formData.get("validTo") ?? "");
    await store.putItem(type, slug, data, {
      lang: typeof data.lang === "string" ? data.lang : "en",
      by: session.name,
      validFrom: validFromRaw ? new Date(validFromRaw) : undefined,
      validTo: validToRaw ? new Date(validToRaw) : undefined,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/", "layout"); // flush the public site's cache
  return { ok: true };
}

export async function deleteItem(admin: AdminContext, formData: FormData): Promise<void> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return;
  const type = parseType(admin, formData.get("type"));
  const slug = String(formData.get("slug") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  await store.deleteItem(type, slug, lang);
  revalidatePath("/", "layout");
  redirect(`/admin/${type}`);
}

export async function restoreVersion(admin: AdminContext, formData: FormData): Promise<void> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return;
  const type = parseType(admin, formData.get("type"));
  const slug = String(formData.get("slug") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  const id = Number(formData.get("id"));
  const versions = await store.listVersions(type, slug, lang);
  const version = versions.find((v) => v.id === id);
  if (!version) return;
  // Restoring = asserting the old data again as a new version (S4).
  await store.putItem(type, slug, version.data, { lang, by: session.name });
  revalidatePath("/", "layout");
  redirect(`/admin/${type}/history/${slug}`);
}

/** Save the content-type relation rules (edited in /admin/relations). */
export async function saveRelations(admin: AdminContext, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await admin.auth.editingSession();
  if (!session) return { ok: false, error: "Not signed in" };
  const store = admin.imprint.writableStore;
  if (!store) return { ok: false, error: "Editing requires DATABASE_URL" };
  try {
    const rules = JSON.parse(String(formData.get("rules") ?? "[]")) as RelationRule[];
    const doc = RelationsDoc.parse({ rules });
    await store.putItem("relations", "relations", doc, { by: session.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath("/admin/relations");
  return { ok: true };
}

/** The bound actions a site hands to the screens (its `"use server"` wrappers). */
export type AdminActions = {
  login: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  logout: (formData: FormData) => Promise<void>;
  saveItem: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  deleteItem: (formData: FormData) => Promise<void>;
  restoreVersion: (formData: FormData) => Promise<void>;
  saveRelations: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  users: UserActions;
  changeOwnPassword: UserAction;
  studio: StudioActions;
};
