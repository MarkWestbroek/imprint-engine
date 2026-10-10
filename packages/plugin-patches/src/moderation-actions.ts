import { revalidatePath } from "next/cache";
import { permit } from "@imprint/content-core";
import type { AdminContext } from "@imprint/runtime-admin";
import { subjectFor } from "@imprint/runtime-admin/admin-server";
import { labHref, patchHref, patchesHref, questionsHref } from "./href";
import { getPatch } from "./patches";
import { Pool, PatchSchema, type Patch } from "./schemas";

/**
 * Moderating the pool from the admin (doc/plans/patch-pool.md §4): move a
 * patch to another pool, mark a question answered, or reject it. For the
 * people who edit the site; the PDP decides as for every other write. The
 * licence is the submitter's: `centraal` asks CC0 (the schema), and only a
 * patch's own author may turn their CC BY into CC0 here — someone else's
 * patch keeps its licence until they choose otherwise.
 */

export type ModerateResult = { ok: boolean; error?: string };

function touched(slug: string) {
  for (const path of [patchesHref(), labHref(), questionsHref(), patchHref(slug), `/members${patchHref(slug)}`, "/admin/patches"]) {
    try {
      revalidatePath(path);
    } catch {
      // no Next.js request context (tests)
    }
  }
}

async function editable(admin: AdminContext, slug: string): Promise<{ patch: Patch; by: string } | ModerateResult> {
  const session = await admin.auth.editingSession();
  if (!session) return { ok: false, error: "Alleen voor de redactie." };
  const store = admin.imprint.writableStore;
  if (!store) return { ok: false, error: "Geen database." };
  const patch = await getPatch(store, slug);
  if (!patch) return { ok: false, error: "Onbekende patch." };
  const subject = await subjectFor(admin, session);
  if (!(await permit(admin.imprint.pdp, subject, "update", { type: "patch", id: slug, properties: { access: patch.access, author: patch.author } }))) {
    return { ok: false, error: "Je mag deze patch niet wijzigen." };
  }
  return { patch, by: session.name };
}

async function save(admin: AdminContext, patch: Patch, next: Partial<Patch>, by: string): Promise<ModerateResult> {
  const parsed = PatchSchema.safeParse({ ...patch, ...next });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige patch." };
  await admin.imprint.writableStore!.putItem("patch", patch.slug, parsed.data, { lang: "en", by });
  touched(patch.slug);
  return { ok: true };
}

/** To another pool. `cc0`: the author moves their own CC BY patch to centraal as CC0. */
export async function moderate(admin: AdminContext, slug: string, pool: string, opts: { cc0?: boolean } = {}): Promise<ModerateResult> {
  const got = await editable(admin, slug);
  if ("ok" in got) return got;
  const target = Pool.safeParse(pool);
  if (!target.success) return { ok: false, error: "Onbekende pool." };
  const { patch, by } = got;
  if (target.data === "centraal" && patch.license !== "CC0") {
    if (!(opts.cc0 && patch.author === by)) {
      return { ok: false, error: `De centrale set is CC0, en ${patch.author || "de inzender"} koos ${patch.license}. Vraag de inzender om CC0, of zet hem in het lab.` };
    }
    return save(admin, patch, { pool: "centraal", license: "CC0" }, by);
  }
  return save(admin, patch, { pool: target.data }, by);
}

/** A question answered (or not any more). */
export async function answered(admin: AdminContext, slug: string, value: boolean): Promise<ModerateResult> {
  const got = await editable(admin, slug);
  if ("ok" in got) return got;
  return save(admin, got.patch, { answered: !!value }, got.by);
}

/** Reject: the patch leaves every pool (a tombstone; History brings it back). */
export async function reject(admin: AdminContext, slug: string): Promise<ModerateResult> {
  const got = await editable(admin, slug);
  if ("ok" in got) return got;
  await admin.imprint.writableStore!.deleteItem("patch", slug, "en");
  touched(slug);
  return { ok: true };
}

export const moderationActions = { moderate, answered, reject };
