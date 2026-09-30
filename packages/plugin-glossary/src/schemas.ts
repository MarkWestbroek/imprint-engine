import { z } from "zod";
import { Access, Locale } from "@imprint/content-core";

/**
 * A term in a glossary (design/communities.md §4.7): a title, a short summary
 * for the overview cards, the full explanation in Markdown, and tags to tell
 * kinds apart (e.g. "afkorting"). Terms link to each other with ordinary
 * links to `/term/<slug>`.
 */
export const TermSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  /** One or two sentences for the overview card; empty = the start of the text. */
  summary: z.string().default(""),
  /** The explanation, in Markdown. */
  body: z.string().default(""),
  tags: z.array(z.string()).default([]),
});
export type Term = z.infer<typeof TermSchema>;
