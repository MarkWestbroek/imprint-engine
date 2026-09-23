import type { ContentType } from "./store";

/**
 * The content-type catalogue (design/fase-3 §7), in two halves:
 *
 *  - **available** — what the model knows: `CONTENT_TYPES` below, one entry
 *    per `ContentType`, with what the generic admin and the write API may do
 *    with it. Today this is derived from the zod schemas by hand; with the
 *    register it comes from the canonical model.
 *  - **active** — which of those a site uses: `imprint.config.ts`
 *    (`contentTypes`), handed round as a `ContentTypeCatalog`. Configuration,
 *    so it belongs in the timeline eventually (§8); for now it is code.
 *
 * Admin routes, server actions and /api/content ask the catalogue instead of
 * each keeping their own list of type names.
 */
export type ContentTypeInfo = {
  /** Plural, as shown in menus and on the dashboard. */
  label: string;
  /** Generic list at /admin/<type>, and the generic save/delete actions. */
  listable: boolean;
  /** Generic item editor and history. False = the type has screens of its own. */
  editable: boolean;
  /** May be pushed through POST /api/content (Bearer INGEST_TOKEN). */
  ingestable: boolean;
  /** A top-level thing an editor thinks in: counted on the dashboard. */
  overview: boolean;
  /** Where the generic list sits in the admin menu; null = reachable, not listed. */
  menu: { group: "content" | "design" | "config"; section?: string } | null;
};

export type ContentTypeFlag = "listable" | "editable" | "ingestable" | "overview";

const t = (label: string, flags: ContentTypeFlag[], menu: ContentTypeInfo["menu"] = null): ContentTypeInfo => ({
  label,
  menu,
  listable: flags.includes("listable"),
  editable: flags.includes("editable"),
  ingestable: flags.includes("ingestable"),
  overview: flags.includes("overview"),
});

/** Available types, in display order. `satisfies` keeps it in step with ContentType. */
export const CONTENT_TYPES = {
  page: t("Pages", ["listable", "editable", "ingestable", "overview"], { group: "content", section: "Site" }),
  product: t("Products", ["listable", "editable", "ingestable", "overview"], { group: "content", section: "Catalogus" }),
  component: t("Components", ["listable", "editable", "ingestable", "overview"], { group: "content", section: "Catalogus" }),
  "board-spec": t("Board specs", ["listable", "editable", "ingestable", "overview"], { group: "content", section: "Catalogus" }),
  release: t("Releases", ["listable", "editable", "ingestable", "overview"], { group: "content", section: "Catalogus" }),
  // Planning boards have their own screens; cards are saved through the generic actions.
  planning: t("Planning", ["overview"]),
  "planning-item": t("Planning items", ["listable"]),
  // Ingestable for wiki publishing (local → live): wiki → folders → pages.
  wiki: t("Wikis", ["listable", "editable", "ingestable", "overview"]),
  "wiki-folder": t("Wiki folders", ["listable", "editable", "ingestable"]),
  "wiki-page": t("Wiki pages", ["listable", "editable", "ingestable"]),
  menu: t("Menus", ["listable", "editable", "overview"], { group: "design" }),
  theme: t("Themes", ["listable", "editable", "overview"], { group: "design" }),
  site: t("Site", ["listable", "editable"], { group: "config" }),
  // Edited as one document in /admin/relations.
  relations: t("Relations", []),
} satisfies Record<ContentType, ContentTypeInfo>;

const AVAILABLE = Object.keys(CONTENT_TYPES) as ContentType[];

export function isContentType(value: string): value is ContentType {
  return Object.hasOwn(CONTENT_TYPES, value);
}

/** The types one site has switched on. Default: everything available. */
export class ContentTypeCatalog {
  private readonly activeTypes: ContentType[];

  constructor(active?: readonly string[]) {
    for (const type of active ?? []) {
      if (!isContentType(type)) {
        throw new Error(`Unknown content type "${type}" (available: ${AVAILABLE.join(", ")})`);
      }
    }
    // Catalogue order, whatever order the site listed them in.
    this.activeTypes = active ? AVAILABLE.filter((type) => active.includes(type)) : AVAILABLE;
  }

  /** Active types, optionally only those with a capability. */
  types(flag?: ContentTypeFlag): ContentType[] {
    return flag ? this.activeTypes.filter((type) => CONTENT_TYPES[type][flag]) : [...this.activeTypes];
  }

  /** Is this (untrusted, e.g. from a URL) name an active type — with this capability? */
  has(type: string, flag?: ContentTypeFlag): type is ContentType {
    return (
      isContentType(type) &&
      this.activeTypes.includes(type) &&
      (flag === undefined || CONTENT_TYPES[type][flag])
    );
  }

  info(type: ContentType): ContentTypeInfo {
    return CONTENT_TYPES[type];
  }
}
