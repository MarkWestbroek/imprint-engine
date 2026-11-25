"use server";

import { slaComponentOp, slaKoppelingOp } from "@imprint/plugin-omnium/koppeling-opslaan";
import type { Opname } from "@imprint/plugin-omnium/component-opname";
import type { KoppelingHandeling } from "@imprint/plugin-omnium/koppeling-register";
import { auth } from "@/lib/admin";

/**
 * Save one action on the omgevingswizard's lines (draw, move, erase) as one
 * registration in the register (Fundament §9). Only someone who may edit; the
 * register sees the bouwer account, the opmerking says on whose behalf.
 */
export async function slaKoppelingOpActie(h: KoppelingHandeling) {
  const session = await auth.editingSession();
  if (!session) return { ok: false as const, fout: "Koppelingen opslaan kan alleen een redacteur." };
  return slaKoppelingOp(h, session.name);
}

/**
 * Take an unrecognised workload into the register as a new Component (step 3
 * of the omgevingswizard), with the same writing account. Only an editor.
 */
export async function slaComponentOpActie(o: Opname) {
  const session = await auth.editingSession();
  if (!session) return { ok: false as const, fout: "Opnemen in het register kan alleen een redacteur." };
  return slaComponentOp(o, session.name);
}
