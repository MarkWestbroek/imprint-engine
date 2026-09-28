"use server";

import * as actions from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** Same shape as the package's ActionResult (a re-export trips the "use server" scanner). */
export type ActionResult = { ok: boolean; error?: string };

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

/** The plugin hook (design/fase-5 §3.3): one dispatcher for every plugin's actions. */
export async function pluginAction(plugin: string, action: string, ...args: unknown[]): Promise<unknown> {
  return actions.runPluginAction(admin, plugin, action, args);
}

/** The media library (design/beeldbibliotheek.md). */
export async function saveAssetAction(slug: string, meta: Record<string, unknown>): Promise<ActionResult> {
  return actions.saveAsset(admin, slug, meta);
}

export async function deleteAssetAction(slug: string, opts?: { group?: boolean }): Promise<ActionResult> {
  return actions.deleteAsset(admin, slug, opts);
}

export async function editTagAction(list: string, tag: string, change: { label?: string; remove?: boolean }): Promise<ActionResult & { affected?: number }> {
  return actions.editTag(admin, list, tag, change);
}

export async function deleteTaglistAction(list: string): Promise<ActionResult & { affected?: number }> {
  return actions.deleteTaglist(admin, list);
}

export async function saveTaglistAction(slug: string | null, list: Record<string, unknown>): Promise<ActionResult & { slug?: string }> {
  return actions.saveTaglist(admin, slug, list);
}

export async function saveRelationsAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return actions.saveRelations(admin, prev, formData);
}
