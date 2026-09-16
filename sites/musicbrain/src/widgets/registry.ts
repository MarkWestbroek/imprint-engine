import { z } from "zod";
import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { standardWidgets } from "@imprint/widgets-standard/schemas";

/**
 * The widget types this site supports (UML: WidgetType). This file is
 * schemas-only — no React, no store — so the ContentStore can import it to
 * validate widget configs at read time.
 *
 * Two sources (architecture.md §3): standard widgets picked one by one from
 * @imprint/widgets-standard, and MusicBrain's domain widgets declared below
 * (products, components, releases, board-specs, planning). Their viewers pair
 * up by name in ./components.tsx.
 */

export const ReleasesConfig = z.object({
  title: z.string().optional(),
  project: z.string().optional(),
  /**
   * Limit to one product's releases. Empty on a default view = the subject
   * product (so _view/product shows "releases of this product").
   */
  product: z.string().optional(),
  limit: z.number().int().positive().default(5),
});
export type ReleasesConfig = z.infer<typeof ReleasesConfig>;

export const ProductsConfig = z.object({
  title: z.string().optional(),
});
export type ProductsConfig = z.infer<typeof ProductsConfig>;

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

export const DownloadsConfig = z.object({
  title: z.string().optional(),
  /** Limit to one project's releases. */
  project: z.string().optional(),
  limit: z.number().int().positive().default(10),
});
export type DownloadsConfig = z.infer<typeof DownloadsConfig>;

/**
 * Subject-widgets (default views): they read the content item the page is
 * about — a product on _view/product — so a view can reproduce everything
 * the hand-coded page shows, but stay studio-editable.
 */

/** Header of the subject: audience eyebrow, name + status badge, tagline, description. */
export const SubjectHeaderConfig = z.object({
  /** Override the heading; default is the subject's name/title. */
  title: z.string().optional(),
  showStatus: z.boolean().default(true),
  showTagline: z.boolean().default(true),
  showDescription: z.boolean().default(true),
});
export type SubjectHeaderConfig = z.infer<typeof SubjectHeaderConfig>;

/** The subject's specs (label/value list) as a table. */
export const SpecTableConfig = z.object({
  title: z.string().default("Specs"),
});
export type SpecTableConfig = z.infer<typeof SpecTableConfig>;

/** The subject product's components, with their board-specs collapsed. */
export const ComponentsConfig = z.object({
  title: z.string().default("Components"),
  showBoards: z.boolean().default(true),
});
export type ComponentsConfig = z.infer<typeof ComponentsConfig>;

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
 * The catalogue as a list, so the admin composer can enumerate it — in the
 * order the studio shows it. Each entry carries its own `version` (the widget
 * is a component of Imprint) and `help` (a one-line manual shown to the
 * editor in the studio sidebar).
 */
export const widgetCatalog = [
  standardWidgets.text,
  standardWidgets.table,
  standardWidgets.image,
  standardWidgets.gallery,
  standardWidgets.carousel,
  standardWidgets.album,
  standardWidgets.map,
  standardWidgets.kanban,
  { name: "planning", label: "Planning board", version: "1.0.0", help: "A live board backed by planning-items: phases as columns, cards with owner, rich text and component links. Edit it in the admin (drag & drop).", configSchema: PlanningConfig },
  standardWidgets.hero,
  standardWidgets.specs,
  { name: "subjectheader", label: "Subject header", version: "1.0.0", help: "Header of the item this view is about: eyebrow, name + status, tagline, description.", configSchema: SubjectHeaderConfig },
  { name: "spectable", label: "Specs table", version: "1.0.0", help: "The subject's specs (label/value) as a table.", configSchema: SpecTableConfig },
  { name: "components", label: "Product components", version: "1.0.0", help: "The subject product's components, with their board-specs collapsed.", configSchema: ComponentsConfig },
  standardWidgets.video,
  standardWidgets.accordion,
  standardWidgets.divider,
  { name: "downloads", label: "Downloads", version: "1.0.0", help: "Release downloads with version and checksum (W7).", configSchema: DownloadsConfig },
  standardWidgets.posts,
  { name: "itinerary", label: "Component itinerary", version: "1.0.0", help: "The journey of each component through a product's releases.", configSchema: ItineraryConfig },
  { name: "board", label: "Board annotations", version: "1.0.0", help: "A PCB render with hover/expanded hotspots per point.", configSchema: BoardConfig },
  { name: "boardspec", label: "Board spec", version: "1.0.0", help: "Render a board-spec: render, connectors, pinouts and notes.", configSchema: BoardSpecConfig },
  standardWidgets.template,
  standardWidgets.list,
  standardWidgets.callout,
  standardWidgets.embed,
  standardWidgets.treeview,
  standardWidgets.api,
  { name: "releases", label: "Releases", version: "1.0.0", help: "The latest releases from the content store.", configSchema: ReleasesConfig },
  { name: "products", label: "Products", version: "1.0.0", help: "A grid of products with their status.", configSchema: ProductsConfig },
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
