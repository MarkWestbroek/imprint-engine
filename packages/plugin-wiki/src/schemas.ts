import { z } from "zod";
import { Access, Locale } from "@imprint/content-core";

/**
 * Pre-Fase-3 wikis carried `visibility: public | members`. Stored versions
 * keep that shape forever (history is never rewritten), so parsing maps it
 * onto `access` — "members" is a policy question now (design/fase-3 §4.3),
 * and "restricted" is the content's side of it.
 */
export function legacyVisibilityToAccess(data: unknown): unknown {
  if (!data || typeof data !== "object" || !("visibility" in data)) return data;
  const { visibility, ...rest } = data as { visibility?: unknown; access?: unknown };
  if ("access" in rest && rest.access !== undefined) return rest;
  return { ...rest, access: visibility === "members" ? "restricted" : "public" };
}

/** The fields; `WikiSchema` wraps them with the legacy mapping. Use this for forms and model exports. */
export const WikiFieldsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  title: z.string().min(1),
  description: z.string().default(""),
  access: Access.default("public"),
  order: z.number().int().default(0),
});
export const WikiSchema = z.preprocess(legacyVisibilityToAccess, WikiFieldsSchema);
export type Wiki = z.infer<typeof WikiFieldsSchema>;

/** A chapter/section in a wiki; nestable via `parent`. */
export const WikiFolderSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  /** Slug of the Wiki this folder belongs to. */
  wiki: z.string().min(1),
  /** Slug of the parent folder; empty = top level of the wiki. */
  parent: z.string().default(""),
  title: z.string().min(1),
  order: z.number().int().default(0),
});
export type WikiFolder = z.infer<typeof WikiFolderSchema>;

export const WikiPageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  /** Slug of the Wiki this page belongs to. */
  wiki: z.string().min(1),
  /** Slug of the WikiFolder holding this page; moving a page = changing this field. */
  folder: z.string().min(1),
  title: z.string().min(1),
  /** Markdown body; plain links (`/help/…`) work, `[[page]]`-shortcuts come later. */
  body: z.string().default(""),
  order: z.number().int().default(0),
});
export type WikiPage = z.infer<typeof WikiPageSchema>;
