import { z } from "zod";
import type { ContentTypeDefinition } from "./content-types";
import { ContentTypeRegistry } from "./content-types";
import { RelationsDoc, type RelationRule } from "./relations";
import {
  BoardSpecSchema,
  ComponentSchema,
  MenuSchema,
  PageMetaSchema,
  PageRecordSchema,
  ProductSchema,
  ReleaseSchema,
  SiteConfigSchema,
  ThemeSchema,
} from "./schemas";

/**
 * The content types the core brings (design/fase-5 §3.1): the definitions
 * that replace the switches on type names that used to live in the store,
 * the catalogue, the relation rules and the admin. Planning and wiki live
 * in their plugins (Fase 5).
 */

const today = () => new Date().toISOString().slice(0, 10);

export const coreContentTypeDefinitions: ContentTypeDefinition[] = [
  {
    name: "page",
    schema: PageRecordSchema,
    formSchema: PageMetaSchema, // body and layout are the studio's, not the form's
    label: "Pages",
    flags: ["listable", "editable", "ingestable", "overview"],
    menu: { group: "content", section: "Site" },
    domain: "site",
    emptyData: () => ({}),
  },
  {
    name: "product",
    schema: ProductSchema,
    label: "Products",
    flags: ["listable", "editable", "ingestable", "overview", "viewable"],
    menu: { group: "content", section: "Catalogus" },
    domain: "catalogus",
    relations: [
      { fromType: "product", field: "components[]", toType: "component", enforce: true, label: "Product → components" },
    ],
    emptyData: () => ({ slug: "", lang: "en", name: "", tagline: "", status: "in-development", description: "", specs: [], media: [], components: [], order: 0 }),
  },
  {
    name: "component",
    schema: ComponentSchema,
    label: "Components",
    flags: ["listable", "editable", "ingestable", "overview", "viewable"],
    menu: { group: "content", section: "Catalogus" },
    domain: "catalogus",
    relations: [
      { fromType: "component", field: "children[]", toType: "component", enforce: true, label: "Component → sub-components" },
    ],
    emptyData: () => ({ slug: "", lang: "en", name: "", description: "", children: [], versions: [] }),
  },
  {
    name: "board-spec",
    schema: BoardSpecSchema,
    label: "Board specs",
    flags: ["listable", "editable", "ingestable", "overview", "viewable"],
    menu: { group: "content", section: "Catalogus" },
    domain: "catalogus",
    relations: [
      { fromType: "board-spec", field: "component", toType: "component", enforce: true, label: "Board-spec → component" },
    ],
    emptyData: () => ({ slug: "", lang: "en", component: "", version: "", connectors: [], assets: { pinouts: {} }, sections: [], related: [] }),
  },
  {
    name: "release",
    schema: ReleaseSchema,
    label: "Releases",
    flags: ["listable", "editable", "ingestable", "overview", "viewable"],
    menu: { group: "content", section: "Catalogus" },
    domain: "catalogus",
    relations: [
      { fromType: "release", field: "product", toType: "product", enforce: true, label: "Release → product" },
      { fromType: "release", field: "components[].component", toType: "component", enforce: true, label: "Release → components" },
    ],
    emptyData: () => ({ project: "", version: "", date: today(), channel: "stable", highlights: [], body: "", downloads: [] }),
    slugOf: (data) => `${String(data.project ?? "")}-${String(data.version ?? "")}`,
  },
  {
    name: "menu",
    schema: MenuSchema,
    // Only the name; the items get the dedicated MenuEditor, not a form.
    formSchema: z.object({ name: z.string() }),
    label: "Menus",
    flags: ["listable", "editable", "overview"],
    menu: { group: "design" },
    domain: "site",
    emptyData: () => ({ name: "", items: [] }),
    slugOf: (data) => String(data.name ?? ""),
  },
  {
    name: "theme",
    schema: ThemeSchema,
    // name/label/order via the form; colours get the dedicated ThemeEditor.
    formSchema: z.object({ name: z.string(), label: z.string(), order: z.number().int() }),
    label: "Themes",
    flags: ["listable", "editable", "overview"],
    menu: { group: "design" },
    domain: "site",
    emptyData: () => ({
      name: "", label: "", order: 0,
      colors: { background: "#0b0d10", surface: "#14181d", border: "#262c33", foreground: "#e8ebee", muted: "#9aa4ae", accent: "#4fd1c5", accentStrong: "#2ab5a8" },
      fonts: { sans: "", mono: "" },
    }),
    slugOf: (data) => String(data.name ?? ""),
  },
  {
    name: "site",
    schema: SiteConfigSchema,
    label: "Site",
    flags: ["listable", "editable"],
    menu: { group: "config" },
    domain: "site",
    emptyData: () => ({ name: "", tagline: "", baseUrl: "https://", defaultLocale: "en", links: {} }),
    slugOf: () => "site",
  },
  {
    // Config type with its own screen (/admin/relations), not a generic form.
    name: "relations",
    schema: RelationsDoc,
    formSchema: z.object({}),
    label: "Relations",
    domain: "site",
    emptyData: () => ({ rules: [] }),
    slugOf: () => "relations",
  },
];

/** The core's registry — what a store validates with when nobody hands it one. */
export const coreContentTypes = new ContentTypeRegistry(coreContentTypeDefinitions);

/** Sensible starting rules: every rule the core types declare (seeded as the "relations" document). */
export const DEFAULT_RELATION_RULES: RelationRule[] = coreContentTypes.relations();
