import type { WritableContentStore } from "@imprint/content-core";
import { GRAMMATICA_GROEPEN, GrammaticaSchema, type Grammatica, type Les } from "./schemas";

/** The grammar topics of the reference (pure, apart from reading the store). */

/** All current topics, in the order of the overview: group, `volgorde`, slug. */
export async function listGrammatica(store: WritableContentStore): Promise<Grammatica[]> {
  const records = await store.listItems("grammatica");
  return records
    .map((r) => GrammaticaSchema.safeParse(r.data))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort(opVolgorde);
}

const opVolgorde = (a: Grammatica, b: Grammatica): number =>
  GRAMMATICA_GROEPEN.indexOf(a.groep) - GRAMMATICA_GROEPEN.indexOf(b.groep) || a.volgorde - b.volgorde || a.slug.localeCompare(b.slug);

/** The id of a topic from its language and slug: what a lesson's `grammatica` lists. */
export const grammaticaId = (taal: string, slug: string): string => `${taal}-${slug}`;

/** A topic can be read in this interface language when it has a title and a text in it. */
export const leesbaar = (g: Grammatica, ui: string): boolean => !!g.titel[ui]?.trim() && !!g.tekst[ui]?.trim();

/**
 * The overview: the rules per group (groups in their fixed order, empty ones
 * left out), then the differences with the reader's language on their own.
 */
export function indeling(topics: Grammatica[]): { groep: Grammatica["groep"] | "verschil"; topics: Grammatica[] }[] {
  const regels = topics.filter((g) => g.soort === "regel").sort(opVolgorde);
  const groepen = GRAMMATICA_GROEPEN.map((groep) => ({ groep, topics: regels.filter((g) => g.groep === groep) }));
  const verschillen = topics.filter((g) => g.soort === "verschil").sort(opVolgorde);
  return [...groepen, { groep: "verschil" as const, topics: verschillen }].filter((g) => g.topics.length > 0);
}

/** The lessons that point at a topic, in lesson order. */
export const lessenOver = (g: Grammatica, lessen: Les[]): Les[] => lessen.filter((l) => l.grammatica.includes(g.id));
