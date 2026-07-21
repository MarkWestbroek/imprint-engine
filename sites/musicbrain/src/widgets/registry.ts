import { z } from "zod";
import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";

/**
 * The widget types this site supports (UML: WidgetType). This file is
 * schemas-only — no React, no store — so the ContentStore can import it to
 * validate widget configs at read time. The matching components live in
 * ./components.tsx; adding a widget type means one schema here + one
 * component there, nothing else.
 */

export const TextConfig = z.object({
  title: z.string().optional(),
  /** Markdown body. */
  markdown: z.string(),
});
export type TextConfig = z.infer<typeof TextConfig>;

export type TreeNode = {
  label: string;
  href?: string;
  children?: TreeNode[];
};
const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    href: z.string().optional(),
    children: z.array(TreeNodeSchema).optional(),
  })
);

export const TreeviewConfig = z.object({
  title: z.string().optional(),
  /** Hand-written tree nodes. */
  items: z.array(TreeNodeSchema).default([]),
  /**
   * Also build a tree from content pages whose slug starts with this prefix
   * ("" = all pages), nested by slug segments.
   */
  pagesPrefix: z.string().optional(),
});
export type TreeviewConfig = z.infer<typeof TreeviewConfig>;

export const ApiConfig = z.object({
  title: z.string().optional(),
  /** JSON endpoint, fetched at render time (= build time in static v0). */
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
  /** Dot-path to the array of items in the response, e.g. "artists" or "data.items". */
  itemsPath: z.string().optional(),
  /** Which fields of each item to show; path is a dot-path into the item. */
  fields: z.array(z.object({ label: z.string(), path: z.string() })).default([]),
  limit: z.number().int().positive().default(10),
});
export type ApiConfig = z.infer<typeof ApiConfig>;

export const ReleasesConfig = z.object({
  title: z.string().optional(),
  project: z.string().optional(),
  limit: z.number().int().positive().default(5),
});
export type ReleasesConfig = z.infer<typeof ReleasesConfig>;

export const ProductsConfig = z.object({
  title: z.string().optional(),
});
export type ProductsConfig = z.infer<typeof ProductsConfig>;

export const TableConfig = z.object({
  title: z.string().optional(),
  headers: z.array(z.string()).default([]),
  /** Row-major cells; each row is an array aligned with `headers`. */
  rows: z.array(z.array(z.string())).default([]),
  striped: z.boolean().default(true),
});
export type TableConfig = z.infer<typeof TableConfig>;

export const ImageConfig = z.object({
  /** URL or a path under the site's public/ dir. */
  src: z.string().min(1),
  alt: z.string().default(""),
  caption: z.string().optional(),
  /** Cap the rendered width in pixels; empty = full column width. */
  maxWidth: z.number().int().positive().optional(),
});
export type ImageConfig = z.infer<typeof ImageConfig>;

export const CalloutConfig = z.object({
  title: z.string().optional(),
  markdown: z.string().default(""),
  tone: z.enum(["accent", "warning", "info", "muted"]).default("accent"),
  /** Optional call-to-action button. */
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
});
export type CalloutConfig = z.infer<typeof CalloutConfig>;

export const EmbedConfig = z.object({
  title: z.string().optional(),
  /** External page to embed in a sandboxed iframe. */
  url: z.string().url(),
  height: z.number().int().positive().default(400),
});
export type EmbedConfig = z.infer<typeof EmbedConfig>;

/** One image in a gallery/carousel/album. */
export const ImageItem = z.object({
  /** URL or a path under public/ or /api/assets. */
  src: z.string().min(1),
  alt: z.string().default(""),
  caption: z.string().optional(),
});
export type ImageItem = z.infer<typeof ImageItem>;

export const GalleryConfig = z.object({
  title: z.string().optional(),
  images: z.array(ImageItem).default([]),
  /** Grid columns on wide screens. */
  columns: z.number().int().min(2).max(6).default(3),
  /** Also include the subject's media[] (e.g. product photos, W3). */
  useSubjectMedia: z.boolean().default(false),
});
export type GalleryConfig = z.infer<typeof GalleryConfig>;

export const CarouselConfig = z.object({
  title: z.string().optional(),
  images: z.array(ImageItem).default([]),
  /** Auto-advance in seconds; 0 = manual only. */
  interval: z.number().int().min(0).max(60).default(0),
  useSubjectMedia: z.boolean().default(false),
});
export type CarouselConfig = z.infer<typeof CarouselConfig>;

/**
 * A view on an *external* photo collection. "json-api" reads any repo that
 * exposes JSON (dot-paths like the api widget); "lightroom-share" is a
 * best-effort scrape of a public share page (e.g. Lightroom mobile album) —
 * it always degrades gracefully to a link card with the cover image.
 */
export const AlbumConfig = z.object({
  title: z.string().optional(),
  source: z.enum(["json-api", "lightroom-share"]).default("lightroom-share"),
  /** Share URL (lightroom-share) or JSON endpoint (json-api). */
  url: z.string().url(),
  /** json-api: dot-path to the item array, and per-item paths. */
  itemsPath: z.string().optional(),
  srcPath: z.string().default("src"),
  captionPath: z.string().optional(),
  limit: z.number().int().positive().default(12),
  columns: z.number().int().min(2).max(6).default(3),
});
export type AlbumConfig = z.infer<typeof AlbumConfig>;

export const MapConfig = z.object({
  title: z.string().optional(),
  /** Fallback centre when there are no markers. */
  center: z.object({ lat: z.number(), lng: z.number() }).optional(),
  zoom: z.number().int().min(1).max(19).default(13),
  height: z.number().int().min(120).max(1200).default(400),
  markers: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number(),
        label: z.string().optional(),
        /** Popup content (markdown). */
        markdown: z.string().optional(),
      })
    )
    .default([]),
});
export type MapConfig = z.infer<typeof MapConfig>;

export const KanbanConfig = z.object({
  title: z.string().optional(),
  columns: z
    .array(
      z.object({
        title: z.string().min(1),
        cards: z
          .array(
            z.object({
              /** Card content (markdown). */
              text: z.string(),
              tone: z.enum(["default", "accent", "warning", "success"]).default("default"),
            })
          )
          .default([]),
      })
    )
    .default([]),
});
export type KanbanConfig = z.infer<typeof KanbanConfig>;

/**
 * A configurable board view (Mark's model): a main item groups sub-items into
 * phases (columns), each sub-item carrying a phase field and optionally an
 * owner. Two ways to point it at data:
 *
 *  - **Board mode** — set `planning` to a planning slug. Sub-items are its
 *    planning-items (phase = `status`, owner = `owner`); phases come from the
 *    planning. This is the default (planbord / kaart / gebruiker), editable
 *    with drag & drop in the admin.
 *  - **Generic mode** — set `itemType` to any content type (e.g. "component").
 *    A read-only view: items are grouped by `phaseField` into the `phases`
 *    you configure here. Moving items happens via their own admin/API (e.g.
 *    the project sets `component.phase`).
 */
export const PlanningConfig = z.object({
  title: z.string().optional(),
  // Board mode
  planning: z.string().default(""),
  // Generic mode
  itemType: z.string().optional(),
  titleField: z.string().default("title"),
  phaseField: z.string().default("status"),
  ownerField: z.string().default("owner"),
  /** Field holding a component slug to show as a chip (e.g. "slug" for components). */
  componentField: z.string().optional(),
  /** Columns for generic mode (board mode takes phases from the planning). */
  phases: z.array(z.object({ key: z.string(), label: z.string().min(1) })).default([]),
  /** Optional filter: only items whose `filterField` equals `filterValue`. */
  filterField: z.string().optional(),
  filterValue: z.string().optional(),
});
export type PlanningConfig = z.infer<typeof PlanningConfig>;

export const HeroConfig = z.object({
  /** Wrap one word in *asterisks* to give it the accent colour. */
  title: z.string().min(1),
  subtitle: z.string().default(""),
  /** Background/side image (URL or public/ path). */
  image: z.string().optional(),
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
  align: z.enum(["left", "center"]).default("left"),
  /** "panel" = card on a surface; "open" = straight on the page background. */
  variant: z.enum(["panel", "open"]).default("panel"),
});
export type HeroConfig = z.infer<typeof HeroConfig>;

export const VideoConfig = z.object({
  title: z.string().optional(),
  /** YouTube/Vimeo page URL, or a direct video file URL. */
  url: z.string().url(),
  caption: z.string().optional(),
});
export type VideoConfig = z.infer<typeof VideoConfig>;

export const AccordionConfig = z.object({
  title: z.string().optional(),
  items: z
    .array(z.object({ title: z.string().min(1), markdown: z.string().default("") }))
    .default([]),
});
export type AccordionConfig = z.infer<typeof AccordionConfig>;

export const DividerConfig = z.object({
  /** "scope" draws a gate/CV step-trace (oscilloscope look) in accent-2. */
  style: z.enum(["line", "dots", "scope", "space"]).default("line"),
  /** Vertical breathing room, 1 (subtle) … 4 (roomy). */
  size: z.number().int().min(1).max(4).default(2),
});
export type DividerConfig = z.infer<typeof DividerConfig>;

/**
 * Specs strip: a row of key figures in mono — big value, small caption —
 * like the spec bar in the "open brain" design (≤ 5 ms · note-on → CV).
 */
export const SpecsConfig = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        /** The big figure, e.g. "≤ 5 ms" or "16-bit". */
        value: z.string().min(1),
        /** Small caption underneath, e.g. "note-on → CV". */
        label: z.string().default(""),
      })
    )
    .default([]),
});
export type SpecsConfig = z.infer<typeof SpecsConfig>;

export const DownloadsConfig = z.object({
  title: z.string().optional(),
  /** Limit to one project's releases. */
  project: z.string().optional(),
  limit: z.number().int().positive().default(10),
});
export type DownloadsConfig = z.infer<typeof DownloadsConfig>;

export const PostsConfig = z.object({
  title: z.string().optional(),
  /** Page-slug prefix that marks a post. */
  prefix: z.string().default("posts/"),
  limit: z.number().int().positive().default(5),
});
export type PostsConfig = z.infer<typeof PostsConfig>;

export const ItineraryConfig = z.object({
  title: z.string().optional(),
  /** Product slug; falls back to the page subject's slug. */
  product: z.string().optional(),
});
export type ItineraryConfig = z.infer<typeof ItineraryConfig>;

export const BoardSpecConfig = z.object({
  title: z.string().optional(),
  /**
   * Slug of the board-spec to render, e.g. "busboard-v2@v2.0". Optional in a
   * default view: left empty, the widget derives it from the subject component.
   */
  spec: z.string().optional(),
});
export type BoardSpecConfig = z.infer<typeof BoardSpecConfig>;

/** Content types a template widget can read from. */
export const TemplateSourceType = z.enum([
  "site",
  "product",
  "component",
  "board-spec",
  "release",
  "page",
  "menu",
]);

export const TemplateConfig = z.object({
  title: z.string().optional(),
  /** Which content item to merge in. Omit to use the page's own subject. */
  type: TemplateSourceType.optional(),
  slug: z.string().optional(),
  /**
   * Markdown with Mustache merge fields: {{field}}, {{nested.field}}, and
   * {{#array}}…{{/array}} to repeat over a list (merge fields / mail merge).
   */
  template: z.string(),
});
export type TemplateConfig = z.infer<typeof TemplateConfig>;

/**
 * List widget: renders links that follow the content graph. Two modes —
 *  - "query": items of a content type, optionally filtered by matchField ==
 *    matchValue (matchValue falls back to the page subject's slug); e.g. the
 *    releases of this product.
 *  - "refs": follow a slug array on the subject (e.g. release.components[]);
 *    each element is a slug, or an object with `itemKey` holding the slug.
 * `linkPattern` builds the href ({slug} is replaced).
 */
export const ListConfig = z.object({
  title: z.string().optional(),
  mode: z.enum(["query", "refs"]).default("query"),
  // query mode
  type: TemplateSourceType.optional(),
  matchField: z.string().optional(),
  matchValue: z.string().optional(),
  limit: z.number().int().positive().optional(),
  // refs mode
  field: z.string().optional(),
  itemKey: z.string().optional(),
  itemType: TemplateSourceType.optional(),
  // both
  linkPattern: z.string().default("/{slug}"),
  labelField: z.string().optional(),
  emptyText: z.string().optional(),
});
export type ListConfig = z.infer<typeof ListConfig>;

/**
 * Annotated board image: a (3D PCB) render with hotspots that reveal detail
 * on hover. Coordinates are relative (0..1) so the annotation stays put at
 * any column width. The hardware toolkit can emit a ready-made config from a
 * board file (hardware/kicad-generators/widget_export.py).
 */
export const BoardConfig = z.object({
  title: z.string().optional(),
  /** URL or a path under the site's public/ dir. */
  image: z.string().min(1),
  alt: z.string().default(""),
  /**
   * "hover": hotspots reveal their detail on mouseover (compact).
   * "expanded": all detail sits in boxes around a smaller image, each with a
   * leader line to its component (the classic "aansluitoverzicht" look).
   */
  mode: z.enum(["hover", "expanded"]).default("hover"),
  points: z
    .array(
      z.object({
        /** Relative position on the image, 0..1 (scales with the render). */
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        /** Short heading shown on the hotspot / tooltip. */
        label: z.string().optional(),
        /** Detail shown on hover, rendered as markdown (e.g. a pin→net table). */
        markdown: z.string().optional(),
        /**
         * D10: URL of a pinout SVG, shown instead of `markdown` — the generated
         * dual-row pinout diagram. One of markdown/svgRef per point.
         */
        svgRef: z.string().optional(),
      })
    )
    .default([]),
});
export type BoardConfig = z.infer<typeof BoardConfig>;

/**
 * The catalogue as a list, so the admin composer can enumerate it. Each entry
 * carries its own `version` (the widget is a component of Imprint) and `help`
 * (a one-line manual shown to the editor in the studio sidebar).
 */
export const widgetCatalog = [
  { name: "text", label: "Text (markdown)", version: "1.0.0", help: "Rich text via markdown, with a visual editor.", configSchema: TextConfig },
  { name: "table", label: "Table", version: "1.0.0", help: "A data table; edit cells, add rows/columns.", configSchema: TableConfig },
  { name: "image", label: "Image", version: "1.0.0", help: "A single image with optional caption.", configSchema: ImageConfig },
  { name: "gallery", label: "Photo gallery", version: "1.0.0", help: "A grid of photos with a lightbox; can include the subject's media.", configSchema: GalleryConfig },
  { name: "carousel", label: "Photo carousel", version: "1.0.0", help: "One photo at a time with prev/next and optional auto-advance.", configSchema: CarouselConfig },
  { name: "album", label: "External album", version: "1.0.0", help: "A view on an online photo repo (JSON API, or a Lightroom share as link card).", configSchema: AlbumConfig },
  { name: "map", label: "Map", version: "1.0.0", help: "An interactive OpenStreetMap with markers and popups.", configSchema: MapConfig },
  { name: "kanban", label: "Kanban board", version: "1.0.0", help: "A small board: columns with static cards.", configSchema: KanbanConfig },
  { name: "planning", label: "Planning board", version: "1.0.0", help: "A live board backed by planning-items: phases as columns, cards with owner, rich text and component links. Edit it in the admin (drag & drop).", configSchema: PlanningConfig },
  { name: "hero", label: "Hero", version: "1.1.0", help: "Big heading + subtitle, optional image and CTA button. *Word* in the title gets the accent colour; variant \"open\" drops the panel.", configSchema: HeroConfig },
  { name: "specs", label: "Specs strip", version: "1.0.0", help: "A row of key figures in mono: big value + small caption.", configSchema: SpecsConfig },
  { name: "video", label: "Video", version: "1.0.0", help: "YouTube/Vimeo (privacy embed) or a direct video file.", configSchema: VideoConfig },
  { name: "accordion", label: "Accordion / FAQ", version: "1.0.0", help: "Collapsible question/answer blocks (no JS needed).", configSchema: AccordionConfig },
  { name: "divider", label: "Divider", version: "1.1.0", help: "Visual rest between rows: line, dots, a scope-trace or just space.", configSchema: DividerConfig },
  { name: "downloads", label: "Downloads", version: "1.0.0", help: "Release downloads with version and checksum (W7).", configSchema: DownloadsConfig },
  { name: "posts", label: "Posts / news feed", version: "1.0.0", help: "Latest devlog posts as linked cards (W6).", configSchema: PostsConfig },
  { name: "itinerary", label: "Component itinerary", version: "1.0.0", help: "The journey of each component through a product's releases.", configSchema: ItineraryConfig },
  { name: "board", label: "Board annotations", version: "1.0.0", help: "A PCB render with hover/expanded hotspots per point.", configSchema: BoardConfig },
  { name: "boardspec", label: "Board spec", version: "1.0.0", help: "Render a board-spec: render, connectors, pinouts and notes.", configSchema: BoardSpecConfig },
  { name: "template", label: "Template (merge fields)", version: "1.0.0", help: "Markdown with {{fields}} merged from a content item.", configSchema: TemplateConfig },
  { name: "list", label: "List (links)", version: "1.0.0", help: "A list of links following the content graph (e.g. a product's releases).", configSchema: ListConfig },
  { name: "callout", label: "Callout / CTA", version: "1.0.0", help: "A coloured box with markdown and an optional button.", configSchema: CalloutConfig },
  { name: "embed", label: "Embed (iframe)", version: "1.0.0", help: "Embed an external page in a sandboxed iframe.", configSchema: EmbedConfig },
  { name: "treeview", label: "Treeview", version: "1.0.0", help: "A nested link tree; can auto-build from page slugs.", configSchema: TreeviewConfig },
  { name: "api", label: "API content", version: "1.0.0", help: "Fetch a JSON endpoint and show selected fields.", configSchema: ApiConfig },
  { name: "releases", label: "Releases", version: "1.0.0", help: "The latest releases from the content store.", configSchema: ReleasesConfig },
  { name: "products", label: "Products", version: "1.0.0", help: "A grid of products with their status.", configSchema: ProductsConfig },
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
