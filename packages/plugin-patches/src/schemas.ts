import { z } from "zod";
import { Access, assetSrc, Locale } from "@imprint/content-core";

/**
 * A patch in the pool (MusicBrain doc/plans/patch-pool.md §3): the file from
 * the editor as a library asset, metadata, a pool (its status) and a licence.
 * The pool decides who sees it: a proposal and a private patch (`prive`: kept
 * for yourself, not up for review) are private to their author and the
 * staff; the rest is public. That link is part of the schema (`access` is
 * derived, never typed), so the admin cannot set the two apart.
 */
export const Pool = z.enum(["prive", "voorstel", "experimenteel", "centraal", "vraag"]);
export type Pool = z.infer<typeof Pool>;
export const POOL_LABELS: Record<Pool, string> = { prive: "privé", voorstel: "voorstel", experimenteel: "experimenteel", centraal: "centraal", vraag: "vraag" };

export const License = z.enum(["CC-BY-4.0", "CC0"]);
export type License = z.infer<typeof License>;
export const LICENSE_LABELS: Record<License, string> = { "CC-BY-4.0": "CC BY 4.0", CC0: "CC0" };

/** What the patch needs to load: the editor and firmware it was made with, and its module types. */
export const Requires = z.object({
  /** Semver of the editor (from its tag), e.g. "0.5.48". */
  editorVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** The editor's build id, free text (e.g. "355-g62e7389"). */
  editorBuild: z.string().optional(),
  /** Semver of the firmware contract the patch speaks. */
  firmwareContract: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** The module types the patch uses, sorted; the editor checks them before loading. */
  moduleTypes: z.array(z.string().min(1)).default([]),
});
export type Requires = z.infer<typeof Requires>;

/** A proposal and a private patch are private; everything else public. */
export const poolAccess = (pool: string): "private" | "public" => (pool === "voorstel" || pool === "prive" ? "private" : "public");

const PatchBase = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  /** Derived from `pool` (see poolAccess); kept as a field so the generic reads can guard it. */
  access: Access.default("public"),
  title: z.string().min(1).max(160),
  /** What it is and how to play it; Markdown. */
  description: z.string().default(""),
  pool: Pool.default("voorstel"),
  /** The account that submitted it; set by the engine, never by a form or the API body. */
  author: z.string().default(""),
  /** `list/tag` for a tag from a tag list (klank/pad, techniek/fm), a bare word for a free tag. */
  tags: z.array(z.string()).default([]),
  /** The `.patch.json` in the library. */
  file: assetSrc(["data"]),
  /** The `.syx`, for a DAW or the Teensy without the editor. */
  syx: assetSrc(["data"]).optional(),
  /** The patch's front (MusicBrain doc/plans/patch-front.md §7): the
   *  black-box view the editor draws, as an SVG; the "cover" of the patch. */
  front: assetSrc(["svg", "image"]).optional(),
  /** Demo recordings: the `group` slugs of takes in the library (wav + mid). */
  takes: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).default([]),
  requires: Requires,
  /** The patch this one was derived from (a relation). */
  derivedFrom: z.string().regex(/^[a-z0-9-]+$/).optional(),
  /** Pool `vraag`: what does not work. */
  question: z.string().optional(),
  answered: z.boolean().default(false),
  license: License.default("CC-BY-4.0"),
  /** ISO date of the first version. */
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const PatchSchema = z.preprocess(
  (raw) => (raw && typeof raw === "object" && "pool" in raw ? { ...(raw as object), access: poolAccess(String((raw as { pool: unknown }).pool)) } : raw),
  PatchBase.superRefine((p, ctx) => {
    if (p.pool === "centraal" && p.license !== "CC0") {
      ctx.addIssue({ code: "custom", path: ["license"], message: "De centrale set is CC0: kies CC0 voordat je een patch naar centraal zet." });
    }
    if (p.pool === "vraag" && !p.question?.trim()) {
      ctx.addIssue({ code: "custom", path: ["question"], message: "Een vraag heeft een vraagtekst." });
    }
  })
);
export type Patch = z.infer<typeof PatchBase>;

/** The fields the generic admin form edits: everything but what is derived or engine-set. */
export const PatchFormSchema = PatchBase.omit({ access: true, author: true, publishedAt: true });

/** What the editor sends to `POST /api/patches` (the plan's §8 step 1): never a pool, never an author. */
export const PatchInput = z.object({
  /** `private`: keep it for yourself (pool `prive`); propose it later with PATCH /api/patches/<slug>. */
  kind: z.enum(["proposal", "question", "private"]).default("proposal"),
  title: z.string().min(1).max(160),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  license: License.default("CC-BY-4.0"),
  file: z.string().regex(/^asset:[a-z0-9-]+$/),
  syx: z.string().regex(/^asset:[a-z0-9-]+$/).optional(),
  /** The front as an SVG asset (optional; the editor sends it along). */
  front: z.string().regex(/^asset:[a-z0-9-]+$/).optional(),
  takes: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).default([]),
  requires: Requires,
  derivedFrom: z.string().regex(/^[a-z0-9-]+$/).optional(),
  question: z.string().optional(),
});
export type PatchInput = z.infer<typeof PatchInput>;

/** PATCH /api/patches/<slug>: a private patch of your own becomes a proposal or a question. Never higher. */
export const PatchPromote = z.object({
  kind: z.enum(["proposal", "question"]),
  question: z.string().optional(),
});
export type PatchPromote = z.infer<typeof PatchPromote>;
