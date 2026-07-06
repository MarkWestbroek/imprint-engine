import { z } from "zod";
import { PageLayoutSchema } from "./widgets";

/**
 * Content schemas — the single source of truth for what content looks like.
 *
 * Two kinds of content (requirement S2):
 *  - structured: product, release — schema-validated, no free HTML
 *  - free-form:  page, post — markdown/MDX body + validated frontmatter
 *
 * Locale handling (S9): every item carries a `lang`; lookups fall back to "en".
 */

export const Locale = z.enum(["en", "nl"]);
export type Locale = z.infer<typeof Locale>;

export const ProductStatus = z.enum([
  "in-development",
  "beta",
  "available",
  "discontinued",
]);
export type ProductStatus = z.infer<typeof ProductStatus>;

export const ProductSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  name: z.string().min(1),
  tagline: z.string().min(1),
  status: ProductStatus,
  description: z.string().default(""),
  /** Ordered key/value spec list, rendered as the specs table (W3). */
  specs: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  /** Paths relative to the site's public/ dir, or absolute URLs. */
  media: z.array(z.string()).default([]),
  order: z.number().int().default(0),
});
export type Product = z.infer<typeof ProductSchema>;

export const ReleaseSchema = z.object({
  /** e.g. "cortex-fw" or "simulator" — which artifact this release belongs to. */
  project: z.string().min(1),
  version: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.enum(["stable", "beta", "dev"]).default("stable"),
  highlights: z.array(z.string()).default([]),
  /** Markdown body (release notes). */
  body: z.string().default(""),
  /** Link back to the source, e.g. the GitHub release (S7). */
  sourceUrl: z.string().url().optional(),
  downloads: z
    .array(
      z.object({
        label: z.string(),
        url: z.string(),
        checksumSha256: z.string().optional(),
      })
    )
    .default([]),
});
export type Release = z.infer<typeof ReleaseSchema>;

/** Frontmatter for free-form pages and devlog posts. */
export const PageMetaSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-/]+$/),
  lang: Locale.default("en"),
  title: z.string().min(1),
  description: z.string().default(""),
  ogImage: z.string().optional(),
  /** Draft pages are ignored by production builds (S5, file-backed version). */
  draft: z.boolean().default(false),
  /** Publish date; pages with a future date are hidden (S6, file-backed version). */
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type PageMeta = z.infer<typeof PageMetaSchema>;

/**
 * A page is either free-form (markdown body) or composed (a PageLayout with
 * widgets) — or both, when a layout page also wants a markdown intro.
 */
export type Page = PageMeta & { body: string; layout?: z.infer<typeof PageLayoutSchema> };

/** JSON page document: meta + layout in one file (pages/<slug>.json). */
export const PageDocSchema = PageMetaSchema.extend({
  layout: PageLayoutSchema,
  /** Optional markdown rendered before/without a "main" region. */
  body: z.string().default(""),
});
export type PageDoc = z.infer<typeof PageDocSchema>;

/**
 * Menu / MenuItem (UML): a named menu of nestable items; an item points to a
 * Page (0..1, by slug), to an external/anchor URL, or is just a group label.
 */
export type MenuItem = {
  label: string;
  /** Slug of the Page this item points to (UML "points to 0..1"). */
  page?: string;
  /** Alternative to `page`: literal href (external URL, anchor, …). */
  url?: string;
  children?: MenuItem[];
};
export const MenuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    page: z.string().optional(),
    url: z.string().optional(),
    children: z.array(MenuItemSchema).optional(),
  })
);

export const MenuSchema = z.object({
  name: z.string().min(1),
  items: z.array(MenuItemSchema).default([]),
});
export type Menu = z.infer<typeof MenuSchema>;

/**
 * Users & roles (UML: User, RoleType, ContentUser). Defined here so the model
 * is complete, but v0 has no login — enforcement arrives with the v1 database
 * store (admin UI). Site-wide role vs. per-content-item role, as in the UML.
 */
export const RoleType = z.enum(["admin", "editor", "reader"]);
export type RoleType = z.infer<typeof RoleType>;

export const ContentUserRoleType = z.enum(["creator", "owner", "contributor"]);
export type ContentUserRoleType = z.infer<typeof ContentUserRoleType>;

export const UserSchema = z.object({
  name: z.string().min(1),
  hashedPassword: z.string(),
  role: RoleType,
});
export type User = z.infer<typeof UserSchema>;

/** Association between a User and one content item (release, page, …). */
export const ContentUserSchema = z.object({
  user: z.string().min(1),
  /** Content reference, e.g. "pages/about" or "releases/simulator-0.1.0". */
  contentRef: z.string().min(1),
  role: ContentUserRoleType,
});
export type ContentUser = z.infer<typeof ContentUserSchema>;

export const SiteConfigSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  baseUrl: z.string().url(),
  defaultLocale: Locale.default("en"),
  links: z.record(z.string(), z.string().url()).default({}),
});
export type SiteConfig = z.infer<typeof SiteConfigSchema>;
