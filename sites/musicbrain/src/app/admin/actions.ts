"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RelationsDoc, type ContentType, type RelationRule } from "@imprint/content-core";
import {
  authenticate,
  canEdit,
  createSessionCookie,
  destroySession,
  getSession,
} from "@/lib/auth";
import { writableStore } from "@/lib/content";

export type ActionResult = { ok: boolean; error?: string };

/** Save the content-type relation rules (edited in /admin/relations). */
export async function saveRelationsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session)) return { ok: false, error: "Not signed in" };
  if (!writableStore) return { ok: false, error: "Editing requires DATABASE_URL" };
  try {
    const rules = JSON.parse(String(formData.get("rules") ?? "[]")) as RelationRule[];
    const doc = RelationsDoc.parse({ rules });
    await writableStore.putItem("relations", "relations", doc, { by: session.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath("/admin/relations");
  return { ok: true };
}

const CONTENT_TYPES: ContentType[] = ["site", "product", "component", "board-spec", "release", "page", "menu", "theme", "planning-item"];

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const session = await authenticate(name, password);
  if (!session) return { ok: false, error: "Wrong username or password" };
  await createSessionCookie(session);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin");
}

function parseType(value: unknown): ContentType {
  const type = String(value) as ContentType;
  if (!CONTENT_TYPES.includes(type)) throw new Error(`Unknown content type "${type}"`);
  return type;
}

/** The natural key lives inside the data, per type (UML: ContentItem /type). */
function slugFor(type: ContentType, data: Record<string, unknown>): string {
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

export async function saveItemAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session)) return { ok: false, error: "Not signed in" };
  if (!writableStore) return { ok: false, error: "Editing requires DATABASE_URL" };

  try {
    const type = parseType(formData.get("type"));
    const data = JSON.parse(String(formData.get("data") ?? "{}")) as Record<
      string,
      unknown
    >;
    const slug = slugFor(type, data);
    if (!slug || slug === "-") return { ok: false, error: "Item needs a slug/name" };

    const validFromRaw = String(formData.get("validFrom") ?? "");
    const validToRaw = String(formData.get("validTo") ?? "");
    await writableStore.putItem(type, slug, data, {
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

export async function deleteItemAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return;
  const type = parseType(formData.get("type"));
  const slug = String(formData.get("slug") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  await writableStore.deleteItem(type, slug, lang);
  revalidatePath("/", "layout");
  redirect(`/admin/${type}`);
}

export async function restoreVersionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return;
  const type = parseType(formData.get("type"));
  const slug = String(formData.get("slug") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  const id = Number(formData.get("id"));
  const versions = await writableStore.listVersions(type, slug, lang);
  const version = versions.find((v) => v.id === id);
  if (!version) return;
  // Restoring = asserting the old data again as a new version (S4).
  await writableStore.putItem(type, slug, version.data, {
    lang,
    by: session.name,
  });
  revalidatePath("/", "layout");
  redirect(`/admin/${type}/history/${slug}`);
}
