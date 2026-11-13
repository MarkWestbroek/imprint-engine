import { z } from "zod";

/**
 * A lesson of the language training (design/taaltraining/README.md). The
 * fields are the frontmatter of a lesson file, so a file imports as it is.
 * Three fields come on top: `slug` (the name in the address), `ombouwen` (the
 * body of the file) and `audio` (filled by the admin action, not by hand).
 * From phase 1 a lesson also has `situatie` and `patroon` (the lesson plan's
 * "Situatie" and "Zag je dat?"), both per language of the reader.
 *
 * `taal` is the language being taught (the lesson package), `steuntaal` the
 * language of the translations. Neither is the item's `lang`: a Polish lesson
 * is another lesson, not a translation of a Dutch one.
 */

/** A two-letter language code: nl, pl, it, de. */
export const Taal = z.string().regex(/^[a-z]{2}$/, "a two-letter language code");

/** One line of the dialogue, per language: `{ nl: "Wat is dit?", pl: "Co to jest?" }`. */
export const Regel = z.record(Taal, z.string());
export type Regel = z.infer<typeof Regel>;

const Opties = z.array(z.string()).min(2);
const Antwoorden = z.array(z.string().min(1)).min(1);

export const Oefening = z.discriminatedUnion("type", [
  /** Hear a sentence, pick what it means. */
  z.object({ type: z.literal("luister"), tekst: z.string().min(1), opties: Opties, antwoord: z.number().int().min(0) }),
  /** Multiple choice. */
  z.object({ type: z.literal("kies"), vraag: z.string().min(1), opties: Opties, antwoord: z.number().int().min(0) }),
  /** Translate and type; every entry of `antwoorden` counts as right. */
  z.object({ type: z.literal("typ"), vraag: z.string().min(1), antwoorden: Antwoorden }),
  /** Put the words of the sentence in order. */
  z.object({ type: z.literal("orden"), zin: z.string().min(1) }),
  /** Say it aloud; `voorbeeld` offers the first answer to listen to first. */
  z.object({ type: z.literal("zeg"), vraag: z.string().min(1), antwoorden: Antwoorden, voorbeeld: z.boolean().optional() }),
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
    /** Recorded sentences: audio key (voice, tempo, text; see audio.ts) → URL in the AssetStore. */
    audio: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((les, ctx) => {
    les.oefeningen.forEach((o, i) => {
      if ((o.type === "kies" || o.type === "luister") && o.antwoord >= o.opties.length) {
        ctx.addIssue({ code: "custom", path: ["oefeningen", i, "antwoord"], message: "antwoord points past the last option" });
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
});
