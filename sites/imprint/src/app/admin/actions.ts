"use server";

import * as actions from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** Same shape as the package's ActionResult (a re-export trips the "use server" scanner). */
export type ActionResult = { ok: boolean; error?: string };

/**
 * The shared admin's actions bound to this site's context. One line each: a
 * "use server" module may only export plain async functions, so the context
 * is passed rather than closed over.
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

export async function saveRelationsAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return actions.saveRelations(admin, prev, formData);
}
