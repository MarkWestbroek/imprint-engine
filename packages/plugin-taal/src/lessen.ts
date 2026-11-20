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

/**
 * A text that exists per language of the reader (`situatie`, `patroon`): in
 * the interface language, or nothing — never in a language the reader did
 * not choose.
 */
export const tekstVoor = (tekst: Record<string, string>, ui: string): string => tekst[ui] ?? "";

/**
 * The translations are shown when the dialogue has them in the interface
 * language: the lesson's own support language, or one added later.
 */
export const metVertaling = (les: Pick<Les, "taal" | "dialoog">, ui: string): boolean =>
  ui !== les.taal && les.dialoog.some((regel) => !!regel[ui]?.trim());

/**
 * The exercises a learner can do in this interface language, as they read for
 * that reader. In the lesson's support language: as written. In another
 * language the `vertaald` part comes in place; `typ` and `zeg` ask in the
 * reader's language and `luister` answers in it, so without a translation
 * they are left out (Dutch taught in Dutch keeps only `kies` and `orden`).
 */
export function oefeningenVoor(les: Pick<Les, "steuntaal" | "oefeningen">, ui: string): Oefening[] {
  if (les.steuntaal === ui) return les.oefeningen;
  return les.oefeningen.flatMap((o): Oefening[] => {
    if (o.type === "orden") return [o];
    const v = o.vertaald?.[ui];
    if (o.type === "kies") return [{ ...o, vraag: v?.vraag ?? o.vraag, opties: v?.opties ?? o.opties }];
    // Options that are only numbers or times read the same for everyone.
    if (o.type === "luister") return v?.opties ? [{ ...o, opties: v.opties }] : o.opties.some((opt) => /\p{L}{2,}/u.test(opt)) ? [] : [o];
    return v?.vraag ? [{ ...o, vraag: v.vraag }] : [];
  });
}
