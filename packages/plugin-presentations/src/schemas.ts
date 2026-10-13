import { z } from "zod";
import { Access, Locale } from "@imprint/content-core";

/**
 * A presentation: a deck of slides, each a fixed 1920×1080 canvas of HTML
 * with inline styles only (the Slides format). The speaker notes live beside
 * the slide, never inside its HTML: the public view reads `html` only, so a
 * note cannot reach a visitor by accident. The HTML is sanitised on import
 * and again when shown (sanitize.ts).
 */
export const SlideSchema = z.object({
  /** Stable id (from the deck's `order`), used in the URL hash: #<id>. */
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  /** The section (chapter) this slide opens or belongs to, if any. */
  section: z.string().optional(),
  /** One `<section>` on the 1920×1080 canvas; inline styles, no scripts. */
  html: z.string(),
  /** Speaker notes, plain text; for the editors only. */
  notes: z.string().default(""),
});
export type Slide = z.infer<typeof SlideSchema>;

export const PresentationSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  description: z.string().default(""),
  /** The outline: a chapter's id, one sentence, and the slide it starts at. */
  sections: z.array(z.object({ id: z.string(), description: z.string().default(""), start: z.string() })).default([]),
  /** Typefaces the slides name: a family and a Google Fonts css2 link. */
  faces: z.array(z.object({ family: z.string(), href: z.string().regex(/^https:\/\/fonts\.googleapis\.com\/css2\?/) })).default([]),
  slides: z.array(SlideSchema).default([]),
});
export type Presentation = z.infer<typeof PresentationSchema>;
