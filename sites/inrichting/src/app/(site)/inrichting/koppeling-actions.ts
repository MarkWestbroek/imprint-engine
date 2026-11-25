"use server";

import { slaKoppelingOp } from "@imprint/plugin-omnium/koppeling-opslaan";
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
