import type { Koppeling } from "./omgeving-wizard";

/**
 * The lines of the omgevingswizard's split view: one per model element a link
 * reads, to the link (its target component). This is the unit the active
 * version will edit (draw = add, move = change `van` or `naar`, erase =
 * remove) once the register has Koppeling; the view only draws what this list
 * says. Kept apart so the browser side can use it without the register code.
 */
export type Lijn = { id: string; koppeling: string; van: string; naar: string };

export function lijnenVan(koppelingen: Koppeling[]): Lijn[] {
  return koppelingen.flatMap((k) => [...new Set(k.bron.ids)].map((van) => ({ id: `${k.id}|${van}`, koppeling: k.id, van, naar: k.doel.component })));
}
