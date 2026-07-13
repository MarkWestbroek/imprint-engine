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
        /** Detail shown on hover; rendered as markdown. */
        markdown: z.string(),
      })
    )
    .default([]),
});
export type BoardConfig = z.infer<typeof BoardConfig>;

/** The catalogue as a list, so the admin composer can enumerate it. */
export const widgetCatalog = [
  { name: "text", label: "Text (markdown)", configSchema: TextConfig },
  { name: "table", label: "Table", configSchema: TableConfig },
  { name: "image", label: "Image", configSchema: ImageConfig },
  { name: "board", label: "Board annotations", configSchema: BoardConfig },
  { name: "callout", label: "Callout / CTA", configSchema: CalloutConfig },
  { name: "embed", label: "Embed (iframe)", configSchema: EmbedConfig },
  { name: "treeview", label: "Treeview", configSchema: TreeviewConfig },
  { name: "api", label: "API content", configSchema: ApiConfig },
  { name: "releases", label: "Releases", configSchema: ReleasesConfig },
  { name: "products", label: "Products", configSchema: ProductsConfig },
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
