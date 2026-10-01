import { z } from "zod";
import { Access, Locale, assetSrc } from "@imprint/content-core";

/**
 * A blog post (design/communities.md §2: "Blogs — een contenttype"): what
 * a member or the editors write, dated, optionally inside a group. The text
 * is Markdown; `access` follows the three levels, so a group's post can be
 * for its members only.
 */
export const PostSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  /** One or two sentences for the lists; empty = the start of the text. */
  summary: z.string().default(""),
  body: z.string().default(""),
  /** Display name of the writer (not an account: posts outlive accounts). */
  author: z.string().default(""),
  /** Publication date, YYYY-MM-DD; the lists sort on it, newest first. */
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()).default([]),
  /** Slug of the group this post belongs to; empty = the site itself. */
  group: z.string().default(""),
  /**
   * A blog post, or a short update in a group's timeline (Pleio's status
   * update): updates stay out of /blog and show on the group's page.
   */
  kind: z.enum(["blog", "update"]).default("blog"),
  /** A library asset (`asset:<slug>`), a URL, or a path under public/. */
  image: assetSrc().optional(),
});
export type Post = z.infer<typeof PostSchema>;
