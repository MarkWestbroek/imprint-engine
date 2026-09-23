"use server";

import { revalidatePath } from "next/cache";
import { RelationsDoc, type RelationRule } from "@imprint/content-core";
import * as actions from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { editingSession } from "@/lib/auth";
import { writableStore } from "@/lib/content";

/** Same shape as the package's ActionResult (a re-export trips the "use server" scanner). */
export type ActionResult = { ok: boolean; error?: string };

/** Save the content-type relation rules (edited in /admin/relations). */
export async function saveRelationsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await editingSession();
  if (!session) return { ok: false, error: "Not signed in" };
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

/**
 * The shared admin's actions (@imprint/runtime-admin/admin-server), bound to
 * this site's context. One line each: a "use server" module may only export
 * plain async functions, so the context is passed rather than closed over.
 */
export async function loginAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return actions.signIn(admin, prev, formData);
}

export async function logoutAction(): Promise<void> {
  return actions.signOut(admin);
}

export async function saveItemAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return actions.saveItem(admin, prev, formData);
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  return actions.deleteItem(admin, formData);
}

export async function restoreVersionAction(formData: FormData): Promise<void> {
  return actions.restoreVersion(admin, formData);
}
