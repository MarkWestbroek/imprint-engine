import { revalidatePath } from "next/cache";
import type { StudioResult } from "../admin/types";
import type { AdminContext } from "../admin-context";
import { applyOp, type DraftOp } from "../studio/layout-ops";
import { clearDraft, draftKey, getDraft, setDraft } from "./drafts";

/**
 * The studio's actions, minus the `"use server"` directive (see actions.ts
 * for why a site wraps them): every edit lands in the server-side draft; the
 * client refreshes and the canvas re-renders from it. Only save writes to the
 * store — a new bitemporal version of the page.
 */

const key = async (admin: AdminContext, slug: string | undefined, lang: string) => {
  const session = await admin.auth.editingSession();
  return session ? { session, key: draftKey(admin.imprint.id, session.name, slug, lang) } : null;
};

/** Apply one edit to the server-side draft; the client refreshes after. */
export async function draftOp(admin: AdminContext, slug: string | undefined, lang: string, op: DraftOp): Promise<StudioResult> {
  const k = await key(admin, slug, lang);
  if (!k) return { ok: false, error: "Not signed in" };
  const draft = getDraft(k.key);
  if (!draft) return { ok: false, error: "Draft expired — reload the page" };
  setDraft(k.key, applyOp(draft, op));
  return { ok: true };
}

/** Throw the draft away; the editor reloads it from the store. */
export async function resetDraft(admin: AdminContext, slug: string | undefined, lang: string): Promise<void> {
  const k = await key(admin, slug, lang);
  if (k) clearDraft(k.key);
}

/** Save = assert the draft as a new version of the page (bitemporal put). */
export async function savePageDraft(
  admin: AdminContext,
  slug: string | undefined,
  lang: string,
  validity: { validFrom?: string; validTo?: string }
): Promise<StudioResult & { slug?: string }> {
  const k = await key(admin, slug, lang);
  if (!k) return { ok: false, error: "Not signed in" };
  const store = admin.imprint.writableStore;
  if (!store) return { ok: false, error: "Editing requires DATABASE_URL" };

  const draft = getDraft(k.key);
  if (!draft) return { ok: false, error: "Draft expired — reload the page" };

  const newSlug = String(draft.meta.slug ?? "");
  if (!newSlug) return { ok: false, error: "Page needs a slug" };

  const data = {
    ...draft.meta,
    body: draft.body,
    ...(draft.rows.length > 0 ? { layout: { rows: draft.rows } } : {}),
  };

  try {
    await store.putItem("page", newSlug, data, {
      lang: typeof draft.meta.lang === "string" ? draft.meta.lang : "en",
      by: k.session.name,
      validFrom: validity.validFrom ? new Date(validity.validFrom) : undefined,
      validTo: validity.validTo ? new Date(validity.validTo) : undefined,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  clearDraft(k.key);
  revalidatePath("/", "layout");
  return { ok: true, slug: newSlug };
}
