import { z } from "zod";
import { assetSrc } from "./schemas";

/**
 * Annotations after the W3C Web Annotation Data Model
 * (https://www.w3.org/TR/annotation-model/), design/annotaties.md: an
 * annotation has one or more targets and zero or more bodies, and a
 * motivation. A target may be narrowed to a segment (a selector) and to a
 * state (the version it was made on — our bitemporal hook). A body is text
 * or a resource (an asset: image, audio, data). React-free: the schemas
 * only; the plugin builds the type and the screens on them.
 */

/** W3C motivations we use; "commenting" without a selector is a plain comment, "replying" a reply. */
export const Motivation = z.enum(["commenting", "replying", "highlighting", "questioning", "tagging", "bookmarking", "describing"]);
export type Motivation = z.infer<typeof Motivation>;

// ── selectors: which segment of the target ────────────────────────────────

/** A quoted passage, with a little text before and after to find it again (W3C TextQuoteSelector). */
export const TextQuoteSelector = z.object({
  type: z.literal("TextQuoteSelector"),
  exact: z.string().min(1),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});

/** Character offsets in the field's text (W3C TextPositionSelector); kept next to the quote, as the spec advises. */
export const TextPositionSelector = z.object({
  type: z.literal("TextPositionSelector"),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

/** A Media Fragment of an asset (W3C FragmentSelector): `xywh=…` for a region of an image, `t=10,20` for a time range. */
export const FragmentSelector = z.object({
  type: z.literal("FragmentSelector"),
  value: z.string().min(1),
  conformsTo: z.string().default("http://www.w3.org/TR/media-frags/"),
});

export const Selector = z.discriminatedUnion("type", [TextQuoteSelector, TextPositionSelector, FragmentSelector]);
export type Selector = z.infer<typeof Selector>;

// ── targets and bodies ────────────────────────────────────────────────────

/**
 * What the annotation is about (W3C SpecificResource): a content item by type
 * and slug — an annotation itself, for a reply — optionally one of its fields,
 * one or more selectors for the segment, and the state: the version
 * (transaction time) the annotation was made on. No field and no selector =
 * the whole item.
 */
export const AnnotationTarget = z.object({
  source: z.object({ type: z.string().min(1), slug: z.string().min(1) }),
  /** The field of the item the selectors point into (`body`, …); empty = the item as a whole. */
  field: z.string().default(""),
  selector: z.array(Selector).default([]),
  /** The version annotated: ISO transaction time of the target's row then (W3C TimeState.sourceDate). */
  state: z.object({ type: z.literal("TimeState"), sourceDate: z.string().min(1) }).optional(),
});
export type AnnotationTarget = z.infer<typeof AnnotationTarget>;

export const TextualBody = z.object({
  type: z.literal("TextualBody"),
  value: z.string().min(1),
  format: z.enum(["text/markdown", "text/plain"]).default("text/markdown"),
  purpose: Motivation.optional(),
});

/** A body that is a resource: an asset from the library (image, audio, data, document), or a URL (a video). */
export const ResourceBody = z.object({
  type: z.literal("Resource"),
  source: assetSrc(["image", "svg", "audio", "data", "document"]),
  purpose: Motivation.optional(),
});

export const AnnotationBody = z.discriminatedUnion("type", [TextualBody, ResourceBody]);
export type AnnotationBody = z.infer<typeof AnnotationBody>;

/** The textual bodies' text, for lists and search. */
export const annotationText = (bodies: AnnotationBody[]) =>
  bodies.flatMap((b) => (b.type === "TextualBody" ? [b.value] : [])).join("\n\n");

/** The W3C JSON-LD form of an annotation (export; `id` is the site's URL for it). */
export function toWebAnnotation(a: { id: string; target: AnnotationTarget[]; body: AnnotationBody[]; motivation: Motivation; author: string; created: string; targetUrl: (t: AnnotationTarget) => string; bodyUrl: (src: string) => string }) {
  return {
    "@context": "http://www.w3.org/ns/anno.jsonld",
    type: "Annotation",
    id: a.id,
    motivation: a.motivation,
    creator: { type: "Person", name: a.author },
    created: a.created,
    body: a.body.map((b) => (b.type === "TextualBody" ? { type: "TextualBody", value: b.value, format: b.format, ...(b.purpose ? { purpose: b.purpose } : {}) } : { id: a.bodyUrl(b.source), ...(b.purpose ? { purpose: b.purpose } : {}) })),
    target: a.target.map((t) => ({
      source: a.targetUrl(t),
      ...(t.selector.length ? { selector: t.selector } : {}),
      ...(t.state ? { state: t.state } : {}),
    })),
  };
}
