import { z } from "zod";

/**
 * The word list behind "check a word" (pure: server, client and Node
 * scripts), one per language taught. Dutch: basic nouns with their article,
 * plural and diminutive, and basic verbs with their forms and their auxiliary
 * in the perfect. Polish: basic nouns with their gender and all their cases,
 * and basic verbs with their aspect, its partner and their forms. Made by
 * sites/taal/scripts/woorden-maken*.ts from Wiktionary; the site hands a list
 * to the plugin as data, it is not content in the store.
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

/** Where the words come from, to show on the page (the licence asks for it). */
const Bron = z.string();

export const NederlandseWoordenlijst = z.object({
  taal: z.literal("nl"),
  bron: Bron,
  naamwoorden: z.array(Naamwoord),
  werkwoorden: z.array(Werkwoord),
});
export type NederlandseWoordenlijst = z.infer<typeof NederlandseWoordenlijst>;

/** The seven cases, in the order of the Polish school grammar; the forms of a noun follow it. */
export const NAAMVALLEN = ["nom", "gen", "dat", "acc", "ins", "loc", "voc"] as const;

/** Seven forms, one per case; empty = the word has no such number (`drzwi`: plural only). */
const Verbuiging = z.array(z.string().min(1)).refine((v) => v.length === 0 || v.length === NAAMVALLEN.length, "seven cases, or none");

export const PoolsNaamwoord = z
  .object({
    /** The word, as the dictionary has it: `sklep`, `drzwi`. */
    w: z.string().min(1),
    /** Gender; a word that is plural only has none: `p` (drzwi), or `pv` when it means men or a mixed group (rodzice). */
    g: z.enum(["m", "f", "n", "p", "pv"]),
    /** Singular, the seven cases. */
    ev: Verbuiging,
    /** Plural, the seven cases. */
    mv: Verbuiging,
    /** What it means, in a few English words (Wiktionary's gloss). */
    b: z.string().optional(),
    r: z.number().int().min(0),
  })
  .refine((n) => n.ev.length > 0 || n.mv.length > 0, "a singular or a plural");
export type PoolsNaamwoord = z.infer<typeof PoolsNaamwoord>;

const Zes = z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string()]);

export const PoolsWerkwoord = z.object({
  /** The infinitive: `robić`. */
  w: z.string().min(1),
  /** Only used with `się`: bać się. The forms are stored without it. */
  sie: z.boolean().optional(),
  /** Aspect: imperfective (doing), perfective (done), or both. */
  asp: z.enum(["ndk", "dk", "beide"]),
  /** The verb(s) of the other aspect: `zrobić`. */
  paar: z.array(z.string()).default([]),
  /** The forms without a helper: ja, ty, on/ona, my, wy, oni/one. The present of an imperfective verb, the future of a perfective one. */
  tt: Zes,
  /** Past tense: ja (a man), ja (a woman), on, ona, oni, one. */
  vt: Zes,
  b: z.string().optional(),
  r: z.number().int().min(0),
});
export type PoolsWerkwoord = z.infer<typeof PoolsWerkwoord>;

export const PoolseWoordenlijst = z.object({
  taal: z.literal("pl"),
  bron: Bron,
  naamwoorden: z.array(PoolsNaamwoord),
  werkwoorden: z.array(PoolsWerkwoord),
});
export type PoolseWoordenlijst = z.infer<typeof PoolseWoordenlijst>;

export const Woordenlijst = z.discriminatedUnion("taal", [NederlandseWoordenlijst, PoolseWoordenlijst]);
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

/** Polish has no article; "this" shows the gender: ten sklep, ta torba, to okno; plural only: te drzwi, ci rodzice. */
export function aanwijzend(g: PoolsNaamwoord["g"]): "ten" | "ta" | "to" | "te" | "ci" {
  return ({ m: "ten", f: "ta", n: "to", p: "te", pv: "ci" } as const)[g];
}

/** For comparing what is typed: lower case, no accents (`ë` → `e`, `ą` → `a`, and the Polish `ł` → `l`), no spaces around. */
export const zoekvorm = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");

type Woord = Naamwoord | Werkwoord | PoolsNaamwoord | PoolsWerkwoord;
export type Treffer<N extends Woord = Naamwoord, V extends Woord = Werkwoord> = { soort: "naamwoord"; woord: N } | { soort: "werkwoord"; woord: V };
export type PoolseTreffer = Treffer<PoolsNaamwoord, PoolsWerkwoord>;

/** Every form a word can be found by: the word itself first, then its other forms. */
function vormenVan(woord: Woord): string[] {
  // Polish noun: every case, singular and plural.
  if ("ev" in woord) return [woord.w, ...woord.ev, ...woord.mv];
  // Polish verb: its forms (not its partner: that is a word of its own).
  if ("asp" in woord) return [woord.w, ...woord.tt, ...woord.vt];
  if ("g" in woord) return [woord.w, ...woord.mv, ...(woord.vk ? [woord.vk] : [])];
  // `sta op` is found by `sta` as well.
  return [woord.w, ...woord.tt, ...woord.vt, woord.vd].flatMap((v) => [v, v.split(" ")[0]!]);
}

type Ingang = { t: Treffer<Woord, Woord>; vormen: string[] };
/** The forms of a list, made once: a list is searched at every key. */
const index = new WeakMap<object, Ingang[]>();
function ingangen(lijst: Woordenlijst): Ingang[] {
  let alle = index.get(lijst);
  if (!alle) {
    const maak = (t: Treffer<Woord, Woord>): Ingang => ({ t, vormen: [...new Set(vormenVan(t.woord).map(zoekvorm))] });
    alle = [
      ...lijst.naamwoorden.map((woord) => maak({ soort: "naamwoord", woord })),
      ...lijst.werkwoorden.map((woord) => maak({ soort: "werkwoord", woord })),
    ];
    index.set(lijst, alle);
  }
  return alle;
}

/**
 * What is typed → the words that fit, best first: the word itself, then a word
 * with that form (`liep` → lopen, `sklepie` → sklep), then words that start
 * with it, then forms that start with it. Within each, the most common first
 * (`r`). A noun and a verb with the same form (`werk`, `werken`) both come.
 */
export function zoek(lijst: NederlandseWoordenlijst, invoer: string, max?: number): Treffer[];
export function zoek(lijst: PoolseWoordenlijst, invoer: string, max?: number): PoolseTreffer[];
export function zoek(lijst: Woordenlijst, invoer: string, max = 8): Treffer<Woord, Woord>[] {
  const q = zoekvorm(invoer);
  if (!q) return [];
  const rang = ({ vormen }: Ingang): number => {
    if (vormen[0] === q) return 0;
    if (vormen.includes(q)) return 1;
    if (vormen[0]!.startsWith(q)) return 2;
    if (vormen.some((v) => v.startsWith(q))) return 3;
    return 9;
  };
  return ingangen(lijst)
    .map((x) => ({ t: x.t, r: rang(x) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.t.woord.r - b.t.woord.r)
    .slice(0, max)
    .map((x) => x.t);
}
