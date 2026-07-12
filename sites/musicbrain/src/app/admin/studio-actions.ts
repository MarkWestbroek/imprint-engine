"use server";

import { revalidatePath } from "next/cache";
import { canEdit, getSession } from "@/lib/auth";
import { writableStore } from "@/lib/content";
import { applyOp, type DraftOp } from "@/lib/layout-ops";
import { clearDraft, draftKey, getDraft, setDraft } from "@/lib/page-draft";

export type StudioResult = { ok: boolean; error?: string };

/** Apply one edit to the server-side draft; the client refreshes after. */
export async function draftOpAction(
  slug: string | undefined,
  lang: string,
  op: DraftOp
): Promise<StudioResult> {
  const session = await getSession();
  if (!canEdit(session)) return { ok: false, error: "Not signed in" };
  const key = draftKey(session.name, slug, lang);
  const draft = getDraft(key);
  if (!draft) return { ok: false, error: "Draft expired — reload the page" };
  setDraft(key, applyOp(draft, op));
  return { ok: true };
}

/** Throw the draft away; the editor reloads it from the store. */
export async function resetDraftAction(
  slug: string | undefined,
  lang: string
): Promise<void> {
  const session = await getSession();
  if (!canEdit(session)) return;
  clearDraft(draftKey(session.name, slug, lang));
}

/** Save = assert the draft as a new version of the page (bitemporal put). */
export async function savePageDraftAction(
  slug: string | undefined,
  lang: string,
  validity: { validFrom?: string; validTo?: string }
): Promise<StudioResult & { slug?: string }> {
  const session = await getSession();
  if (!canEdit(session)) return { ok: false, error: "Not signed in" };
  if (!writableStore) return { ok: false, error: "Editing requires DATABASE_URL" };

  const key = draftKey(session.name, slug, lang);
  const draft = getDraft(key);
  if (!draft) return { ok: false, error: "Draft expired — reload the page" };

  const newSlug = String(draft.meta.slug ?? "");
  if (!newSlug) return { ok: false, error: "Page needs a slug" };

  const data = {
    ...draft.meta,
    body: draft.body,
    ...(draft.rows.length > 0 ? { layout: { rows: draft.rows } } : {}),
  };

  try {
    await writableStore.putItem("page", newSlug, data, {
      lang: typeof draft.meta.lang === "string" ? draft.meta.lang : "en",
      by: session.name,
      validFrom: validity.validFrom ? new Date(validity.validFrom) : undefined,
      validTo: validity.validTo ? new Date(validity.validTo) : undefined,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  clearDraft(key);
  revalidatePath("/", "layout");
  return { ok: true, slug: newSlug };
}
