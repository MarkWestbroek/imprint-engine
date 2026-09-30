import { z } from "zod";
import { Access, Locale, assetSrc } from "@imprint/content-core";

/**
 * A group (community, design/communities.md §4.2 and §7): its public face —
 * name, summary for the cards, introduction and description, image, tags —
 * and how one joins. Membership itself is not content but personal data
 * (G1); the group's wiki is a Wiki of its own (`wiki`, at most one), its
 * pages are Pages under `groups/<slug>/…`.
 */
export const GroupSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  /** One or two sentences for the overview card. */
  summary: z.string().default(""),
  /** Markdown, shown at the top of the group page (Pleio: introduction). */
  introduction: z.string().default(""),
  /** Markdown, the full description. */
  body: z.string().default(""),
  /** A library asset (`asset:<slug>`), a URL, or a path under public/. */
  image: assetSrc().optional(),
  tags: z.array(z.string()).default([]),
  /** Closed: content for members only (G2); until then informational. */
  closed: z.boolean().default(false),
  /** Joining needs the manager's approval (G1); until then informational. */
  membershipOnRequest: z.boolean().default(false),
  /** Slug of the group's Wiki; empty = none. */
  wiki: z.string().default(""),
  /** Number of members at import time (Pleio), until membership lives here. */
  memberCount: z.number().int().nonnegative().optional(),
  order: z.number().int().default(0),
});
export type Group = z.infer<typeof GroupSchema>;
