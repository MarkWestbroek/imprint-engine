"use server";

import { slaOpVoorPad } from "@imprint/plugin-omnium/werkplaats-opslaan";
import type { FormulierActie } from "@imprint/plugin-omnium";
import { auth } from "@/lib/admin";

/**
 * Save the werkplaats form to the dienstversie's branch in the Studio
 * (werkplaats-plan Fase B, laag 2). Only someone who may edit (the engine's
 * policy, as for the admin); the Studio sees them as `namens`.
 */
export async function slaWerkplaatsOp(pad: string[], acties: FormulierActie[]) {
  const session = await auth.editingSession();
  if (!session) return { ok: false as const, opgeslagen: 0, fout: "Opslaan kan alleen een redacteur." };
  return slaOpVoorPad(pad, acties, session.name);
}
