import type { Locale, Page, Product, Release, SiteConfig } from "./schemas";

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
  getSiteConfig(): Promise<SiteConfig>;

  listProducts(opts?: ReadOptions): Promise<Product[]>;
  getProduct(slug: string, opts?: ReadOptions): Promise<Product | null>;

  listReleases(opts?: ReadOptions & { project?: string }): Promise<Release[]>;

  listPages(opts?: ReadOptions & { prefix?: string }): Promise<Page[]>;
  getPage(slug: string, opts?: ReadOptions): Promise<Page | null>;
}
