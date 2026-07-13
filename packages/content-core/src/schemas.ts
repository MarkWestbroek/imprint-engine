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
  /**
   * Slugs of the components this product is built from (UML: Product ◆ Component).
   * Components are their own content type because they're reusable across
   * products; here we just reference them.
   */
  components: z.array(z.string()).default([]),
  /** Optional documentation: a page slug, or inline markdown (see §docs). */
  docs: z.string().optional(),
  order: z.number().int().default(0),
});
export type Product = z.infer<typeof ProductSchema>;

/**
 * VersionNumber (UML dataType): a self-validating version string, e.g.
 * "v2.5.12", "1.0", "2026.03-beta.1". Optional leading `v`, dot-separated
 * numeric segments, optional pre-release/build suffix. Kept broad enough for
 * real-world schemes but strict enough to reject nonsense — the "OO" bit is
 * that the type validates itself wherever it's used (release/component versions).
 */
export const VERSION_RE = /^v?\d+(\.\d+)*([.-][0-9A-Za-z-]+)*$/;
export const VersionNumber = z
  .string()
  .regex(VERSION_RE, 'Invalid version (expected e.g. "v2.5.12" or "1.0.0")');
export type VersionNumber = z.infer<typeof VersionNumber>;

/** One version of a component (UML: ComponentVersion). */
export const ComponentVersionSchema = z.object({
  number: VersionNumber,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Version-specific notes (markdown). */
  notes: z.string().default(""),
});
export type ComponentVersion = z.infer<typeof ComponentVersionSchema>;

/**
 * A component (UML: Component): a standalone, reusable building block. It is
 * its own content type — not nested inside a product — precisely because the
 * same component can appear in several products. Components can nest
 * (`children`), e.g. a busboard that contains modules.
 */
export const ComponentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  name: z.string().min(1),
  description: z.string().default(""),
  /** Slugs of sub-components (nesting). */
  children: z.array(z.string()).default([]),
  /** Known versions of this component. */
  versions: z.array(ComponentVersionSchema).default([]),
  /** Optional documentation: a page slug, or inline markdown. */
  docs: z.string().optional(),
});
export type Component = z.infer<typeof ComponentSchema>;

export const ReleaseSchema = z.object({
  /** e.g. "cortex-fw" or "simulator" — which artifact this release belongs to. */
  project: z.string().min(1),
  version: VersionNumber,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.enum(["stable", "beta", "dev"]).default("stable"),
  /** Slug of the Product this release belongs to (UML: Product ◆ ProductRelease). */
  product: z.string().optional(),
  /**
   * The components in this release, each with the version that ships in it
   * (UML: the ReleaseComponent association carries the ComponentVersion). We
   * reference the component + note its version, rather than pointing at a
   * ComponentVersion entity — a version isn't a component.
   */
  components: z
    .array(z.object({ component: z.string(), version: VersionNumber }))
    .default([]),
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

/**
 * Derived view (UML: ProductComponentItinerary): the journey a component makes
 * with a product — from the first release it appears in to the last. Computed
 * from a product's releases, never stored.
 */
export type ComponentItinerary = {
  component: string;
  /** Date of the first release containing the component. */
  start: string;
  /** Date of the last release containing it (null = still current). */
  end: string | null;
  firstRelease: string;
  lastRelease: string;
  /** Versions seen along the way, in release order. */
  versions: string[];
};

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
