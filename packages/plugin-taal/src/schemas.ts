import { z } from "zod";

/**
 * A lesson of the language training (design/taaltraining/README.md). The
 * fields are the frontmatter of a lesson file, so a file imports as it is.
 * Three fields come on top: `slug` (the name in the address), `ombouwen` (the
 * body of the file) and `audio` (filled by the admin action, not by hand).
 * From phase 1 a lesson also has `situatie` and `patroon` (the lesson plan's
 * "Situatie" and "Zag je dat?"), both per language of the reader, and
 * `grammatica`: links to the reference (GrammaticaSchema below).
 *
 * `taal` is the language being taught (the lesson package), `steuntaal` the
 * language the lesson was written for: the plain `vraag` and `opties` of the
 * exercises are in it. A lesson can serve more readers: the dialogue,
 * `situatie` and `patroon` have a text per language, and an exercise carries
 * the other languages under `vertaald` (lessen.ts: `oefeningenVoor`). Neither
 * is the item's `lang`: a Polish lesson is another lesson, not a translation
 * of a Dutch one.
 */

/** A two-letter language code: nl, pl, it, de. */
export const Taal = z.string().regex(/^[a-z]{2}$/, "a two-letter language code");

/** One line of the dialogue, per language: `{ nl: "Wat is dit?", pl: "Co to jest?" }`. */
export const Regel = z.record(Taal, z.string());
export type Regel = z.infer<typeof Regel>;

const Opties = z.array(z.string()).min(2);
const Antwoorden = z.array(z.string().min(1)).min(1);
/**
 * An exercise for readers of another language than the lesson's `steuntaal`:
 * `vertaald: { en: { vraag: "I was in Poland." } }`. Only what is in the
 * support language is repeated (`vraag`, or `opties` when they are the
 * translations); answers in the language taught stay as they are.
 */
const Vertaald = z.record(Taal, z.object({ vraag: z.string().min(1).optional(), opties: Opties.optional() })).optional();

export const Oefening = z.discriminatedUnion("type", [
  /** Hear a sentence, pick what it means. */
  z.object({ type: z.literal("luister"), tekst: z.string().min(1), opties: Opties, antwoord: z.number().int().min(0), vertaald: Vertaald }),
  /** Multiple choice. */
  z.object({ type: z.literal("kies"), vraag: z.string().min(1), opties: Opties, antwoord: z.number().int().min(0), vertaald: Vertaald }),
  /** Translate and type; every entry of `antwoorden` counts as right. */
  z.object({ type: z.literal("typ"), vraag: z.string().min(1), antwoorden: Antwoorden, vertaald: Vertaald }),
  /** Put the words of the sentence in order. */
  z.object({ type: z.literal("orden"), zin: z.string().min(1) }),
  /** Say it aloud; `voorbeeld` offers the first answer to listen to first. */
  z.object({ type: z.literal("zeg"), vraag: z.string().min(1), antwoorden: Antwoorden, voorbeeld: z.boolean().optional(), vertaald: Vertaald }),
]);
export type Oefening = z.infer<typeof Oefening>;

export const LesSchema = z
  .object({
    /** The key of the lesson: `nl-0-01` (language, phase, number). Lessons sort on it. */
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** The name in the address (`dit-en-dat`); empty = the id. */
    slug: z.string().regex(/^[a-z0-9-]*$/).default(""),
    taal: Taal,
    steuntaal: Taal.optional(),
    fase: z.number().int().min(0),
    module: z.string().default(""),
    titel: z.string().min(1),
    /** Where you are, in one sentence, per language of the reader: `{ pl: "…", nl: "…" }`. */
    situatie: Regel.default({}),
    dialoog: z.array(Regel).default([]),
    /** "Did you see that?": the one pattern of this lesson, at most three sentences (Markdown), per language of the reader. */
    patroon: Regel.default({}),
    /** The chunks of this lesson: fixed pieces to use as they are. */
    brokken: z.array(z.string()).default([]),
    oefeningen: z.array(Oefening).default([]),
    /** The assignment to rebuild the dialogue yourself, in Markdown. */
    ombouwen: z.string().default(""),
    /** The grammar topics this lesson touches (ids of `grammatica` items): "more about this" under "Did you see that?". */
    grammatica: z.array(z.string()).default([]),
    /** Recorded sentences: audio key (voice, tempo, text; see audio.ts) → URL in the AssetStore. */
    audio: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((les, ctx) => {
    les.oefeningen.forEach((o, i) => {
      if ((o.type === "kies" || o.type === "luister") && o.antwoord >= o.opties.length) {
        ctx.addIssue({ code: "custom", path: ["oefeningen", i, "antwoord"], message: "antwoord points past the last option" });
      }
      for (const [taal, v] of Object.entries(("vertaald" in o && o.vertaald) || {})) {
        if (v.opties && "opties" in o && v.opties.length !== o.opties.length) {
          ctx.addIssue({ code: "custom", path: ["oefeningen", i, "vertaald", taal, "opties"], message: "as many options as the exercise has" });
        }
      }
    });
  });
export type Les = z.infer<typeof LesSchema>;

/** What the generated form edits: everything but the recordings. */
export const LesFormSchema = z.object({
  id: z.string(),
  slug: z.string().default(""),
  taal: Taal,
  steuntaal: Taal.optional(),
  fase: z.number().int().min(0),
  module: z.string().default(""),
  titel: z.string(),
  situatie: Regel.default({}),
  dialoog: z.array(Regel).default([]),
  patroon: Regel.default({}),
  brokken: z.array(z.string()).default([]),
  oefeningen: z.array(Oefening).default([]),
  ombouwen: z.string().default(""),
  grammatica: z.array(z.string()).default([]),
});

/**
 * A grammar topic: the reference beside the lessons. Where a lesson shows one
 * pattern in passing ("Did you see that?"), a topic gives the forms in full —
 * a table, the rule, the exceptions — kept short. The texts are per language
 * of the reader, like `patroon`; bold is the language taught (speakable).
 *
 * `soort` "verschil" is a topic about a difference with the reader's own
 * language as a whole (no articles in Polish, no cases in Dutch); `anders` is
 * the same for one topic: a paragraph "unlike in Polish", per reader language.
 */
export const GRAMMATICA_GROEPEN = ["werkwoorden", "naamwoorden", "voornaamwoorden", "zinsbouw"] as const;

export const GrammaticaSchema = z.object({
  /** The key: `nl-tegenwoordige-tijd` (language taught + slug). Lessons point at it. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** The name in the address: `/pl/nederlands/grammatica/<slug>`. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  taal: Taal,
  soort: z.enum(["regel", "verschil"]).default("regel"),
  /** Where the topic stands in the overview; a "verschil" stands with the differences, whatever its group. */
  groep: z.enum(GRAMMATICA_GROEPEN).default("werkwoorden"),
  /** Order within the group (low first). */
  volgorde: z.number().int().default(0),
  /** The title per language of the reader: `{ pl: "Czas teraźniejszy", nl: "De tegenwoordige tijd" }`. */
  titel: Regel.refine((t) => Object.keys(t).length > 0, "a title in at least one language"),
  /** One sentence for the overview, per language of the reader. */
  kort: Regel.default({}),
  /** The topic itself (Markdown, tables allowed), per language of the reader. */
  tekst: Regel.default({}),
  /** "Unlike in <your language>": how the reader's own language does it, per language of the reader. */
  anders: Regel.default({}),
});
export type Grammatica = z.infer<typeof GrammaticaSchema>;
