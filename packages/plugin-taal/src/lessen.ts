import type { WritableContentStore } from "@imprint/content-core";
import { lesSlug } from "./href";
import { LesSchema, type Les, type Oefening } from "./schemas";

/** All current lessons, in order of their id (`nl-0-01`, `nl-0-02`, …). */
export async function listLessen(store: WritableContentStore): Promise<Les[]> {
  const records = await store.listItems("les");
  return records
    .map((r) => LesSchema.safeParse(r.data))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

export async function getLes(store: WritableContentStore, id: string): Promise<Les | null> {
  const record = await store.getItem("les", id);
  const parsed = record ? LesSchema.safeParse(record.data) : null;
  return parsed?.success ? parsed.data : null;
}

/** The lesson of one package behind a name in the address. */
export async function lesInPakket(store: WritableContentStore, taal: string, slug: string): Promise<Les | null> {
  return (await listLessen(store)).find((l) => l.taal === taal && lesSlug(l) === slug) ?? null;
}

/** Lessons per phase, phases in order. */
export function perFase(lessen: Les[]): { fase: number; lessen: Les[] }[] {
  const fasen = new Map<number, Les[]>();
  for (const les of lessen) fasen.set(les.fase, [...(fasen.get(les.fase) ?? []), les]);
  return [...fasen.entries()].sort(([a], [b]) => a - b).map(([fase, lessen]) => ({ fase, lessen }));
}

/** The translations are shown when the interface is in the lesson's support language. */
export const metVertaling = (les: Pick<Les, "steuntaal">, ui: string): boolean => !!les.steuntaal && les.steuntaal === ui;

/**
 * The exercises a learner can do in this interface language. `typ` and `zeg`
 * ask in the support language and `luister` answers in it, so without it
 * (Dutch taught in Dutch) only `kies` and `orden` remain.
 */
export function oefeningenVoor(les: Pick<Les, "steuntaal" | "oefeningen">, ui: string): Oefening[] {
  return metVertaling(les, ui) ? les.oefeningen : les.oefeningen.filter((o) => o.type === "kies" || o.type === "orden");
}
