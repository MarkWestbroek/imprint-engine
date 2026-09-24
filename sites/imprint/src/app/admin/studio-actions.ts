"use server";

import * as studio from "@imprint/runtime-admin/admin-server";
import type { DraftOp } from "@imprint/runtime-admin/studio";
import { admin } from "@/lib/admin";

/** Same shape as the package's StudioResult (a re-export trips the "use server" scanner). */
export type StudioResult = { ok: boolean; error?: string };

// One-line wrappers around the shared studio's actions; see app/admin/actions.ts.
export async function draftOpAction(slug: string | undefined, lang: string, op: DraftOp): Promise<StudioResult> {
  return studio.draftOp(admin, slug, lang, op);
}

export async function resetDraftAction(slug: string | undefined, lang: string): Promise<void> {
  return studio.resetDraft(admin, slug, lang);
}

export async function savePageDraftAction(
  slug: string | undefined,
  lang: string,
  validity: { validFrom?: string; validTo?: string }
): Promise<StudioResult & { slug?: string }> {
  return studio.savePageDraft(admin, slug, lang, validity);
}
