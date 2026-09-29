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

/**
 * Who may read a content item (design/fase-3 §4.3, decision: publiek/beperkt).
 * "public" needs no policy decision at all and may be prerendered; "restricted"
 * is only ever rendered per request, after the PDP said yes (access.ts).
 * Configuration types (site, menu, theme, relations) have no access value.
 */
export const Access = z.enum(["public", "restricted"]);
export type Access = z.infer<typeof Access>;

/* ---------- the media library (design/beeldbibliotheek.md) ---------- */

/**
 * A reference to a library asset inside a string field: `asset:<slug>`
 * (design/beeldbibliotheek.md §3). Every image or file field stays a string,
 * so a plain URL keeps working (the "uitweg") and no stored content has to
 * change; viewers resolve the reference when they render.
 */
export const ASSET_REF_PREFIX = "asset:";

/** The asset slug a field value refers to, or null for a plain URL/path. */
export function assetRefSlug(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(ASSET_REF_PREFIX) ? value.slice(ASSET_REF_PREFIX.length) || null : null;
}

/**
 * A string field that holds an image or file: an `asset:<slug>` reference or
 * a URL. The marker (`x-imprint.asset` = the kinds it accepts) reaches the
 * JSON Schema, and the admin form turns the field into a library picker.
 */
export function assetSrc(kinds: string[] = ["image", "svg"]) {
  return z.string().min(1).meta({ "x-imprint": { asset: kinds } });
}

/** What happens to EXIF in the web variants; the original always keeps its own. */
export const ExifPolicy = z.enum(["all", "no-location", "none"]);
export type ExifPolicy = z.infer<typeof ExifPolicy>;

/** A scaled web copy of an image (WebP), made at upload. */
export const AssetVariant = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
});
export type AssetVariant = z.infer<typeof AssetVariant>;

/** Camera data read from EXIF at upload (shown and filtered on, e.g. in a portfolio). */
export const AssetPhoto = z.object({
  taken: z.string().optional(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  fNumber: z.number().optional(),
  /** Seconds, e.g. 0.004 for 1/250. */
  exposure: z.number().optional(),
  iso: z.number().optional(),
  focalLength: z.number().optional(),
});
export type AssetPhoto = z.infer<typeof AssetPhoto>;

/** Read from a WAV header at upload. */
export const AssetAudio = z.object({
  /** Seconds. */
  duration: z.number().nonnegative().optional(),
  sampleRate: z.number().int().positive().optional(),
  channels: z.number().int().positive().optional(),
  bitDepth: z.number().int().positive().optional(),
});
export type AssetAudio = z.infer<typeof AssetAudio>;

/** What a data file is: a MIDI file's header, or a JSON document's declared type. */
export const AssetData = z.object({
  format: z.enum(["midi", "json"]),
  /** MIDI: 0, 1 or 2. */
  midiFormat: z.number().int().optional(),
  tracks: z.number().int().optional(),
  /** MIDI: ticks per quarter note. */
  ppq: z.number().int().optional(),
  /** JSON: `$schema`, `type` or `kind` of the top-level object, when it names one. */
  type: z.string().optional(),
});
export type AssetData = z.infer<typeof AssetData>;

/**
 * The file kinds the core handles (design/beeldbibliotheek.md §12.2). The
 * record accepts any kind name, so a plugin can add one (e.g. 3D models)
 * without a schema change; these are the ones with a handler in the engine.
 */
export const CORE_ASSET_KINDS = ["image", "svg", "document", "audio", "data"] as const;
export type CoreAssetKind = (typeof CORE_ASSET_KINDS)[number];

/** Default upload limits per kind, in bytes; a site overrides them in `imprint.config.ts` (`media.maxBytes`). */
export const DEFAULT_MEDIA_MAX_BYTES: Record<CoreAssetKind, number> = {
  image: 50 * 1024 * 1024,
  svg: 5 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  audio: 200 * 1024 * 1024,
  data: 20 * 1024 * 1024,
};

/**
 * A tag list (design/beeldbibliotheek.md §4): a small, named vocabulary such
 * as "Onderwerp" or "Project". A tag on content is written `list/tag`
 * (`onderwerp/portret`); a tag without a list is a free tag. Core, and not
 * only for media — pages and other types can use the same lists later.
 */
export const TaglistSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  name: z.string().min(1),
  description: z.string().optional(),
  /** Open: editors may add tags while tagging. Closed: only pick. */
  open: z.boolean().default(true),
  tags: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1) })).default([]),
  order: z.number().int().default(0),
});
export type Taglist = z.infer<typeof TaglistSchema>;

/**
 * One item in the media library (design/beeldbibliotheek.md §2). The file
 * part is written at upload and never by a form; the rest is what an editor
 * describes and orders. Access holds per format (§7): with `access: public`
 * variants up to `publicMaxWidth` are public (all of them when absent); larger
 * variants and the original are not — the original never is.
 */
export const AssetRecordSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  publicMaxWidth: z.number().int().positive().optional(),
  title: z.string().default(""),
  alt: z.string().default(""),
  caption: z.string().optional(),
  credit: z.string().optional(),
  licence: z.string().optional(),
  source: z.string().optional(),
  /** One place, like a file system: "schetsen/2026"; "" = the root. */
  folder: z.string().regex(/^[a-z0-9_/ -]*$/i).default(""),
  /** `list/tag` for a tag from a tag list, a bare word for a free tag. */
  tags: z.array(z.string()).default([]),
  /**
   * Files that belong together as one (§12.3): e.g. a recording's wav, mid and
   * patch.json. The library shows a group as one card; moving and deleting
   * apply to the whole group.
   */
  group: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  /** When the asset was first added (ISO); a later version keeps it. Older assets lack it. */
  created: z.string().optional(),
  /** Focal point for cropping, 0..1 from top-left. */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  file: z.object({
    filename: z.string(),
    /** One of CORE_ASSET_KINDS, or a plugin's kind. */
    kind: z.string().min(1),
    mime: z.string(),
    size: z.number().int().nonnegative(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    /** The uploaded bytes, untouched (EXIF included). Never public. */
    original: z.string(),
    variants: z.array(AssetVariant).default([]),
    exif: ExifPolicy,
  }),
  photo: AssetPhoto.optional(),
  audio: AssetAudio.optional(),
  data: AssetData.optional(),
  /** Only kept with EXIF policy "all": the location is shown on purpose. */
  gps: z.object({ lat: z.number(), lon: z.number() }).optional(),
});
export type AssetRecord = z.infer<typeof AssetRecordSchema>;

/** The part of an asset a person edits (the library's detail pane). */
export const AssetMetaSchema = AssetRecordSchema.pick({
  title: true,
  alt: true,
  caption: true,
  credit: true,
  licence: true,
  source: true,
  folder: true,
  tags: true,
  access: true,
  publicMaxWidth: true,
  focus: true,
});
export type AssetMeta = z.infer<typeof AssetMetaSchema>;

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
  access: Access.default("public"),
  name: z.string().min(1),
  tagline: z.string().min(1),
  /** Small-caps audience line above the name on cards, e.g. "for modular synths". */
  audience: z.string().default(""),
  status: ProductStatus,
  description: z.string().default(""),
  /** Ordered key/value spec list, rendered as the specs table (W3). */
  specs: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  /** Library assets (`asset:<slug>`), paths relative to public/, or absolute URLs. */
  media: z.array(assetSrc()).default([]),
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
  /**
   * Slug of the board-spec documenting this exact revision (D8: one board-spec
   * per ComponentVersion). Convention: "<component>@<number>". Optional — not
   * every version is a board.
   */
  spec: z.string().optional(),
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
  access: Access.default("public"),
  name: z.string().min(1),
  /**
   * What sort of component this is — "board" (default), "software", … Open
   * string, no enum: new kinds must not need a migration (MMB-FR component-
   * kind). Drives the version heading on the component page.
   */
  kind: z.string().default("board"),
  description: z.string().default(""),
  /** Slugs of sub-components (nesting). */
  children: z.array(z.string()).default([]),
  /** Known versions of this component. */
  versions: z.array(ComponentVersionSchema).default([]),
  /**
   * Optional lifecycle phase (design → beta → produced …). Free string so a
   * project can name its own phases; lets a planning-widget render components
   * as a board (grouped by this field) without a separate planning-item per
   * component. The project typically sets this over the API.
   */
  phase: z.string().default(""),
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
  access: Access.default("public"),
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

/**
 * board-spec (D1–D10): machine-generated documentation of one PCB revision —
 * one per ComponentVersion (D8). Slug convention: "<component>@<version>".
 * The technical core (connectors, nets, asset URLs) is language-neutral; only
 * the prose `sections` are translatable via the usual per-lang overlay (S9).
 * Assets are referenced by URL; producing those URLs (upload/AssetStore) is a
 * later step — this schema just holds them.
 */
export const BoardConnectorSchema = z.object({
  /** Connector reference on the board, e.g. "J1". */
  ref: z.string().min(1),
  label: z.string().default(""),
  footprint: z.string().default(""),
  /** 1 = single row, 2 = dual row (D10: most headers are dual-row). */
  rows: z.number().int().min(1).max(2).default(1),
  pins: z.array(z.object({ pin: z.string(), net: z.string() })).default([]),
});
export type BoardConnector = z.infer<typeof BoardConnectorSchema>;

export const BoardSpecSchema = z.object({
  /** "<component>@<version>", so it allows @ and dots. */
  slug: z.string().regex(/^[a-z0-9@.\-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  /** Back-reference to the Component this board is (a RelationRule enforces it). */
  component: z.string().min(1),
  /** Which ComponentVersion this documents. */
  version: VersionNumber,
  /** Kind override per spec (else the component's `kind` counts): "board", "software", … */
  kind: z.string().optional(),
  /** Structured connector data, read straight from the .kicad_pcb (D1, D2). */
  connectors: z.array(BoardConnectorSchema).default([]),
  /** Rendered assets, by role, as URLs (D2, D3). */
  assets: z
    .object({
      renderTop: z.string().optional(),
      renderBottom: z.string().optional(),
      /** The wiring-overview SVG. */
      overview: z.string().optional(),
      /** 3D model (binary glTF, .glb) for the 3D tab — versioned like the rest. */
      model3d: z.string().optional(),
      /** Per-connector pinout SVG, keyed by connector ref (D10). */
      pinouts: z.record(z.string(), z.string()).default({}),
    })
    .default({ pinouts: {} }),
  /**
   * 3D view config (MMB-request 3D-tab). `src` may point at a static file;
   * the versioned `assets.model3d` wins when both are present (cache-safe:
   * content-hashed URL, republish = new URL).
   */
  view3d: z
    .object({
      mode: z.string().default("glb"),
      src: z.string().optional(),
      poster: z.string().optional(),
    })
    .optional(),
  /**
   * Hotspot positions on the render (relative 0..1), so a board widget can be
   * derived (D4). `connector` auto-links that connector's pinout SVG (D10).
   */
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        label: z.string().optional(),
        /** Connector ref (e.g. "J1"); links assets.pinouts[ref] as the detail. */
        connector: z.string().optional(),
        markdown: z.string().optional(),
      })
    )
    .default([]),
  /** README-style prose blocks (D4); translatable. */
  sections: z.array(z.object({ heading: z.string(), markdown: z.string() })).default([]),
  /** Fab/order info (D5). */
  fab: z
    .object({
      packageUrl: z.string().optional(),
      jlcNotes: z.string().default(""),
      bomHighlights: z.array(z.string()).default([]),
    })
    .optional(),
  /** Related board-specs/components, by slug (D6). */
  related: z.array(z.string()).default([]),
});
export type BoardSpec = z.infer<typeof BoardSpecSchema>;

/** Frontmatter for free-form pages and devlog posts. */
export const PageMetaSchema = z.object({
  // underscore allowed so reserved slugs like "_view/component" (default-view
  // templates) are valid page slugs.
  slug: z.string().regex(/^[a-z0-9_/-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  description: z.string().default(""),
  ogImage: assetSrc().optional(),
  /** Draft pages are ignored by production builds (S5, file-backed version). */
  draft: z.boolean().default(false),
  /** Publish date; pages with a future date are hidden (S6, file-backed version). */
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type PageMeta = z.infer<typeof PageMetaSchema>;

/** Page payload as stored: meta + markdown body and/or a widget layout (validated against the site's widgets by the store). */
export const PageRecordSchema = PageMetaSchema.extend({
  body: z.string().default(""),
  layout: PageLayoutSchema.optional(),
});

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
 * Wiki (site-in-de-site, design/wiki.md): a self-contained bundle of
 * information about one subject — like a book: folders are chapters, pages
 * are pages, and neither means anything without the binding. The wiki slug
 * is the URL prefix (`/<wiki>/…`); navigation is the folder/page tree.
 */


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

/**
 * Theme: a named set of design tokens (colours, fonts) delivered as CSS
 * custom properties on `[data-theme="<name>"]`. Follows the spirit of the
 * W3C Design Tokens (DTCG) idea — tokens as data, presentation reads vars —
 * kept deliberately flat so the admin can edit it with colour pickers.
 * Structural layout (logo position, chrome variants) is a separate concern.
 */
export const ThemeColorsSchema = z.object({
  background: z.string().min(1),
  surface: z.string().min(1),
  border: z.string().min(1),
  foreground: z.string().min(1),
  muted: z.string().min(1),
  accent: z.string().min(1),
  accentStrong: z.string().min(1),
  /** Second accent (scope traces, secondary highlights); empty = falls back to `accent`. */
  accent2: z.string().default(""),
});
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

export const ThemeSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  colors: ThemeColorsSchema,
  /** CSS font stacks; empty = keep the site's default (next/font vars). */
  fonts: z
    .object({
      sans: z.string().default(""),
      mono: z.string().default(""),
    })
    .default({ sans: "", mono: "" }),
  order: z.number().int().default(0),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const SiteConfigSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  /** Short brand line under the wordmark (e.g. "open hardware · est. NL"); empty = tagline. */
  motto: z.string().default(""),
  baseUrl: z.string().url(),
  defaultLocale: Locale.default("en"),
  links: z.record(z.string(), z.string().url()).default({}),
  /**
   * URL-aliases: eerste padsegment → doel-route, permanent geredirect.
   * Bijv. { "hw": "components" } maakt /hw/adc8 → /components/adc8 — zoals
   * de silk-opdruk op de MusicBrain-borden (musicbrain.nl/hw/<naam>).
   */
  aliases: z.record(z.string(), z.string()).default({}),
  /**
   * GitHub-releasefeed (W2/S7): "owner/repo" → hoe binnenkomende release-
   * webhooks gemapt worden. Repos die hier niet staan worden genegeerd.
   */
  releaseSources: z
    .record(
      z.string(),
      z.object({
        /** Release.project voor deze repo (bijv. "cortex-fw"). */
        project: z.string().min(1),
        /** Optioneel: product-slug waar de release onder hangt. */
        product: z.string().optional(),
      })
    )
    .default({}),
});
export type SiteConfig = z.infer<typeof SiteConfigSchema>;
