import type {
  BoardSpec,
  Component,
  Locale,
  Menu,
  Page,
  Product,
  Release,
  SiteConfig,
  Theme,
} from "./schemas";

/**
 * ContentStore — the narrow interface between sites and content storage (B3).
 *
 * v0 implementation: FileContentStore (content lives as files in git).
 * v1 implementation: database-backed store (Plesk MySQL/Postgres) with
 *     bitemporal-light columns (valid_from/valid_to/tx_from/tx_to), which is
 *     why every read takes an optional `asOf` — the file store simply treats
 *     it as "hide items published after this moment".
 *
 * Keep this interface small; anything a site needs from content goes through
 * here, so swapping storage never touches page code.
 */

export interface ReadOptions {
  /** Render the site as it was/will be valid at this moment (S5/S6 preview). */
  asOf?: Date;
  /** Preferred language; stores fall back to "en" when missing (S9). */
  lang?: Locale;
  /** Include drafts (preview mode only). */
  includeDrafts?: boolean;
}

export interface ContentStore {
  /**
   * Site configuration travels in time like everything else (only `asOf`
   * matters here). Before the first assertion a store answers with the current
   * config instead of nothing: no page, not even a 404, renders without one.
   */
  getSiteConfig(opts?: ReadOptions): Promise<SiteConfig>;

  listProducts(opts?: ReadOptions): Promise<Product[]>;
  getProduct(slug: string, opts?: ReadOptions): Promise<Product | null>;

  listReleases(opts?: ReadOptions & { project?: string; product?: string }): Promise<Release[]>;

  listComponents(opts?: ReadOptions): Promise<Component[]>;
  getComponent(slug: string, opts?: ReadOptions): Promise<Component | null>;

  listBoardSpecs(opts?: ReadOptions & { component?: string }): Promise<BoardSpec[]>;
  getBoardSpec(slug: string, opts?: ReadOptions): Promise<BoardSpec | null>;

  listPages(opts?: ReadOptions & { prefix?: string }): Promise<Page[]>;
  getPage(slug: string, opts?: ReadOptions): Promise<Page | null>;

  /** Named navigation menus (UML: Menu/MenuItem), e.g. "main", "footer". */
  getMenu(name: string, opts?: ReadOptions): Promise<Menu | null>;

  /** Design-token themes (delivered as CSS vars; user-switchable). */
  listThemes(opts?: ReadOptions): Promise<Theme[]>;
}

/** The types the core brings; the typed read methods above are theirs. */
export type CoreContentType =
  | "site"
  | "product"
  | "component"
  | "board-spec"
  | "release"
  | "page"
  | "menu"
  | "theme"
  | "wiki"
  | "wiki-folder"
  | "wiki-page"
  | "relations";

/**
 * A content type name. Open on purpose (design/fase-5, decision 1): plugins
 * register their own types, so the compiler cannot know the full list; the
 * `ContentTypeRegistry` guards it at runtime — nothing unregistered is ever
 * written. The core names stay literal for editor completion.
 */
export type ContentType = CoreContentType | (string & {});

/** One stored assertion of a content item (a row, in bitemporal terms). */
export interface ContentRecord {
  id: number;
  type: ContentType;
  slug: string;
  lang: string;
  data: unknown;
  validFrom: Date;
  validTo: Date | null;
  txFrom: Date;
  txTo: Date | null;
  createdBy: string | null;
}

/**
 * Write side, used by the admin/editor — sites' public pages only ever need
 * the read-only ContentStore above. Every put supersedes the current
 * assertion (transaction time) instead of overwriting, so history is free.
 */
export interface WritableContentStore extends ContentStore {
  /** Current assertions, ignoring valid time (admin sees drafts/scheduled). */
  listItems(type: ContentType): Promise<ContentRecord[]>;
  getItem(type: ContentType, slug: string, lang?: string): Promise<ContentRecord | null>;
  /** Validates `data` against the type's schema, then asserts a new version. */
  putItem(
    type: ContentType,
    slug: string,
    data: unknown,
    opts?: { lang?: string; validFrom?: Date; validTo?: Date | null; by?: string }
  ): Promise<void>;
  /** Ends the current assertion (content disappears; history stays). */
  deleteItem(type: ContentType, slug: string, lang?: string): Promise<void>;
  /** Full version history (S4), newest first. */
  listVersions(type: ContentType, slug: string, lang?: string): Promise<ContentRecord[]>;
}
