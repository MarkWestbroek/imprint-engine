import { z } from "zod";
import { WidgetTypeRegistry } from "@imprint/content-core";

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

/** The catalogue as a list, so the admin composer can enumerate it. */
export const widgetCatalog = [
  { name: "text", label: "Text (markdown)", configSchema: TextConfig },
  { name: "treeview", label: "Treeview", configSchema: TreeviewConfig },
  { name: "api", label: "API content", configSchema: ApiConfig },
  { name: "releases", label: "Releases", configSchema: ReleasesConfig },
  { name: "products", label: "Products", configSchema: ProductsConfig },
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  (registry, def) => registry.register(def),
  new WidgetTypeRegistry()
);
