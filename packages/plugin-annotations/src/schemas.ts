import { z } from "zod";
import { AnnotationBody, AnnotationTarget, Locale, Motivation } from "@imprint/content-core";

/**
 * An annotation as stored (design/annotaties.md): the W3C shape — targets,
 * bodies, motivation — plus the plumbing every item has. No `access` of its
 * own: who may read it follows from the root target, resolved when listing.
 * Hiding by a moderator is a version like any edit.
 */
export const AnnotationSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  /** The account that wrote it; set by the engine, never by a form. */
  author: z.string().min(1),
  /** ISO moment of the first version (the row's own time repeats it; this one survives edits). */
  created: z.string().min(1),
  motivation: Motivation.default("commenting"),
  target: z.array(AnnotationTarget).min(1),
  body: z.array(AnnotationBody).default([]),
  /** The author changed the bodies after the first version ("bewerkt"; the history has the versions). */
  edited: z.boolean().default(false),
  /** Hidden by a moderator: kept, shown only to moderators. */
  hidden: z.boolean().default(false),
  hiddenBy: z.string().default(""),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

/** Whether an item may be annotated, and by whom (resolved per type or per item; a policy input). */
export const AnnotationSetting = z.enum(["off", "members", "public"]);
export type AnnotationSetting = z.infer<typeof AnnotationSetting>;
