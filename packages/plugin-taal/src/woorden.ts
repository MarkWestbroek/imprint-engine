import { z } from "zod";

/**
 * The word list behind "check a word" (pure: server, client and Node
 * scripts): basic nouns with their article, plural and diminutive, and basic
 * verbs with their forms and their auxiliary in the perfect. Made by
 * sites/taal/scripts/woorden-maken.ts from Wiktionary; the site hands it to
 * the plugin as data, it is not content in the store.
 */

/** Gender as Wiktionary gives it: m, f, n, or more than one, the usual first (`f/n`: de school). */
export const Geslacht = z.string().regex(/^[mfn](\/[mfn])*$/);

export const Naamwoord = z.object({
  /** The word: `huis`. */
  w: z.string().min(1),
  g: Geslacht,
  /** Plural(s), the usual first; empty = no plural (`melk`). */
  mv: z.array(z.string()).default([]),
  /** Diminutive (always `het`), if there is one. */
  vk: z.string().optional(),
  /** Frequency rank: low = common. Orders the suggestions across nouns and verbs. */
  r: z.number().int().min(0),
});
export type Naamwoord = z.infer<typeof Naamwoord>;

export const Werkwoord = z.object({
  /** The infinitive: `lopen`. */
  w: z.string().min(1),
  /** Present tense: ik, jij, hij/zij, wij/jullie/zij (main clause: `sta op`). */
  tt: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  /** Past tense: singular, plural. */
  vt: z.tuple([z.string(), z.string()]),
  /** Past participle: `gelopen`. */
  vd: z.string(),
  /** The auxiliary of the perfect: hebben, zijn, or both (`heeft/is gelopen`, by meaning). */
  hulp: z.enum(["hebben", "zijn", "beide"]),
  /** Not by the regular pattern (strong or irregular). */
  sterk: z.boolean().default(false),
  r: z.number().int().min(0),
});
export type Werkwoord = z.infer<typeof Werkwoord>;

export const Woordenlijst = z.object({
  taal: z.string(),
  /** Where the words come from, to show on the page (the licence asks for it). */
  bron: z.string(),
  naamwoorden: z.array(Naamwoord),
  werkwoorden: z.array(Werkwoord),
});
export type Woordenlijst = z.infer<typeof Woordenlijst>;

/**
 * The article of a noun: n → het, m and f → de. The first gender is the
 * usual one (Wiktionary's order); `ook` is the other article, when a second
 * gender takes one (`n/f`: het hart, also de).
 */
export function lidwoord(g: string): { hoofd: "de" | "het"; ook?: "de" | "het" } {
  const art = (x: string) => (x === "n" ? "het" : "de");
  const [eerste = "m", ...rest] = g.split("/");
  const hoofd = art(eerste);
  const ander = rest.map(art).find((a) => a !== hoofd);
  return ander ? { hoofd, ook: ander } : { hoofd };
}

/** For comparing what is typed: lower case, no accents (`ë` → `e`), no spaces around. */
export const zoekvorm = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

export type Treffer = { soort: "naamwoord"; woord: Naamwoord } | { soort: "werkwoord"; woord: Werkwoord };

/** Every form a word can be found by: the word itself first, then its other forms. */
function vormenVan(t: Treffer): string[] {
  if (t.soort === "naamwoord") return [t.woord.w, ...t.woord.mv, ...(t.woord.vk ? [t.woord.vk] : [])];
  const w = t.woord;
  // `sta op` is found by `sta` as well.
  return [w.w, ...w.tt, ...w.vt, w.vd].flatMap((v) => [v, v.split(" ")[0]!]);
}

/**
 * What is typed → the words that fit, best first: the word itself, then a word
 * with that form (`liep` → lopen), then words that start with it, then forms
 * that start with it. Within each, the most common first (`r`). A noun and a
 * verb with the same form (`werk`, `werken`) both come.
 */
export function zoek(lijst: Pick<Woordenlijst, "naamwoorden" | "werkwoorden">, invoer: string, max = 8): Treffer[] {
  const q = zoekvorm(invoer);
  if (!q) return [];
  const alle: Treffer[] = [
    ...lijst.naamwoorden.map((woord) => ({ soort: "naamwoord" as const, woord })),
    ...lijst.werkwoorden.map((woord) => ({ soort: "werkwoord" as const, woord })),
  ];
  const rang = (t: Treffer): number => {
    const vormen = vormenVan(t).map(zoekvorm);
    if (vormen[0] === q) return 0;
    if (vormen.includes(q)) return 1;
    if (vormen[0]!.startsWith(q)) return 2;
    if (vormen.some((v) => v.startsWith(q))) return 3;
    return 9;
  };
  return alle
    .map((t) => ({ t, r: rang(t) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.t.woord.r - b.t.woord.r)
    .slice(0, max)
    .map((x) => x.t);
}
