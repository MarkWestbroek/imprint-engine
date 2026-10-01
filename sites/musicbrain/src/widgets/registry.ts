import { z } from "zod";
import { assetSrc, WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { planningWidgets } from "@imprint/plugin-planning";
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
 * A recorded take from the patch editor (design/beeldbibliotheek.md §12): the
 * editor chooses the take's wav from the library; the viewer finds the .mid of
 * the same group and shows the piano roll under the audio.
 */
export const TakeConfig = z.object({
  /** The take's audio (a library asset, `asset:<slug>`, or a URL). */
  src: assetSrc(["audio"]),
  title: z.string().optional(),
  /** Height of the piano roll in px (fixed, so the page does not jump). */
  height: z.number().int().min(80).max(600).default(160),
  /** Show the controller lane (mod wheel, aftertouch, bend, CC). */
  controllers: z.boolean().default(true),
});
export type TakeConfig = z.infer<typeof TakeConfig>;

/**
 * Annotated board image: a (3D PCB) render with hotspots that reveal detail
 * on hover. Coordinates are relative (0..1) so the annotation stays put at
 * any column width. The hardware toolkit can emit a ready-made config from a
 * board file (hardware/kicad-generators/widget_export.py).
 */
export const BoardConfig = z.object({
  title: z.string().optional(),
  /** A library asset (`asset:<slug>`), a URL, or a path under the site's public/ dir. */
  image: assetSrc(),
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

/** A point or offset in unit millimetres: x to the right, y depth (0 = panel front, positive = towards the back), z up. */
const mm3 = z.tuple([z.number(), z.number(), z.number()]);

/**
 * The hardware unit assembling itself (Mark, 1 Oct 2026: "zodat je kunt zien
 * hoe een MusicBrain hardware-unit er uiteindelijk uitziet"). Each part is a
 * board-spec whose 3D model (the KiCad GLB behind the "3D" tab) flies from
 * `from` to `at` on a shared timeline; the front panel is extruded from its
 * SVG drawing, holes included. Coordinates follow doc/mechanics/
 * MusicBrainAssembly.FCMacro in the MusicBrain repo, so the choreography can
 * be shared with a Blender render of the same scene.
 */
export const AssemblyPartConfig = z.object({
  /** Board-spec slug, e.g. "adc8@v2.0"; its `assets.model3d` is the model. */
  spec: z.string().min(1),
  /** Caption while this part moves, e.g. "ADC8 → slot 1". */
  label: z.string().optional(),
  /** Centre of the board when seated, in unit mm. */
  at: mm3,
  /** Direction of the board's normal when seated: "x" = vertical card, "y" = parallel to the panel, "z" = flat. */
  normal: z.enum(["x", "y", "z"]).default("y"),
  /** Rotation around that normal, in degrees. */
  spin: z.number().default(0),
  /** Turn the board over (components to the other side). */
  flip: z.boolean().default(false),
  /** Where it starts, as an offset from `at` (mm). */
  from: mm3.default([0, -120, 0]),
  /** When it starts moving, 0..1 of the timeline, and how long it takes (fraction). */
  start: z.number().min(0).max(1).default(0),
  duration: z.number().min(0.01).max(1).default(0.1),
});
export type AssemblyPartConfig = z.infer<typeof AssemblyPartConfig>;

export const AssemblyConfig = z.object({
  title: z.string().optional(),
  /** Panel width and height in mm — the frame the coordinates live in. */
  width: z.number().positive().default(200),
  height: z.number().positive().default(128.5),
  /**
   * Front panel from an SVG drawing (URL or a path under public/): the
   * element with class "panel" is the plate, circles and rects with classes
   * hole/pot/enc/btn/din/usb/mnt/disp become holes. Leave empty for no panel.
   */
  panel: z
    .object({
      svg: z.string().min(1),
      thickness: z.number().positive().default(2),
      from: mm3.default([0, -140, 0]),
      start: z.number().min(0).max(1).default(0.86),
      duration: z.number().min(0.01).max(1).default(0.1),
    })
    .optional(),
  /** Eurorack rails top and bottom, seated last. */
  rails: z.boolean().default(true),
  parts: z.array(AssemblyPartConfig).default([]),
  /** Length of one run in seconds; the camera circles slowly while it plays. */
  seconds: z.number().min(2).max(300).default(24),
  autoplay: z.boolean().default(true),
  loop: z.boolean().default(true),
  /** Music under the animation (URL or public path); starts on the visitor's play click, never by itself. */
  audio: z.string().optional(),
  caption: z.string().optional(),
});
export type AssemblyConfig = z.infer<typeof AssemblyConfig>;

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
  ...planningWidgets,
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
  { name: "take", label: "Take (audio + piano roll)", version: "1.0.0", help: "A take from the patch editor: pick its wav; the .mid of the same take shows as a piano roll you can play, seek and loop.", configSchema: TakeConfig },
  { name: "boardspec", label: "Board spec", version: "1.0.0", help: "Render a board-spec: render, connectors, pinouts and notes.", configSchema: BoardSpecConfig },
  { name: "assembly", label: "Hardware assembly", version: "1.0.0", help: "The unit assembling itself in 3D: board-specs fly into place on a timeline, with the front panel from its SVG. Play, scrub, drag to look around.", configSchema: AssemblyConfig },
  standardWidgets.template,
  standardWidgets.list,
  standardWidgets.callout,
  standardWidgets.embed,
  standardWidgets.treeview,
  standardWidgets.api,
  standardWidgets.quote,
  standardWidgets.code,
  standardWidgets.mermaid,
  standardWidgets.v3model,
  standardWidgets.tabs,
  standardWidgets.cards,
  standardWidgets.buttons,
  standardWidgets.logos,
  standardWidgets.toc,
  standardWidgets.breadcrumb,
  standardWidgets.audio,
  standardWidgets.pdf,
  standardWidgets.file,
  standardWidgets.timeline,
  standardWidgets.mediatext,
  standardWidgets.people,
  standardWidgets.testimonial,
  standardWidgets.pricing,
  { name: "releases", label: "Releases", version: "1.0.0", help: "The latest releases from the content store.", configSchema: ReleasesConfig },
  { name: "products", label: "Products", version: "1.0.0", help: "A grid of products with their status.", configSchema: ProductsConfig },
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
