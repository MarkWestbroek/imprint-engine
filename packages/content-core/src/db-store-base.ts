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
  type BoardSpec,
  type Component,
  type Menu,
  type Page,
  type Product,
  type Release,
  type SiteConfig,
  type Theme,
} from "./schemas";
import type { WidgetTypeRegistry } from "./widgets";
import type { ContentTypeRegistry } from "./content-types";
import { coreContentTypes } from "./core-content-types";
import {
  RelationsDoc,
  validateReferences,
  type RelationRule,
} from "./relations";
import type {
  ContentRecord,
  ContentStore,
  ContentType,
  ReadOptions,
  WritableContentStore,
} from "./store";


/** What every database backend takes: the site's widget registry (page layouts) and content-type registry (payloads). */
export type StoreOptions = { widgets?: WidgetTypeRegistry; contentTypes?: ContentTypeRegistry };

/** One `content_items` row, dialect-neutral (what every backend hands up). */
export type ContentRow = {
  id: number;
  type: string;
  slug: string;
  lang: string;
  data: unknown;
  validFrom: Date;
  validTo: Date | null;
  txFrom: Date;
  txTo: Date | null;
  createdBy: string | null;
};

/** A new assertion to insert (id is assigned by the database). */
export type NewContentRow = Omit<ContentRow, "id">;

/**
 * Database-backed ContentStore (v1, bitemporal-light §B3) plus the write side
 * for the admin — the dialect-neutral part. Everything a site can observe
 * (language fallback to "en" (S9), drafts hidden unless asked (S5), asOf on
 * both time axes (S6), validation, referential integrity, supersede-not-
 * overwrite) lives here, once. A concrete backend (MariaDB, Postgres, …) only
 * implements the six row operations below, so every database backend is
 * contract-equal by construction (architecture.md §0 rule 3, §8).
 */
export abstract class DbContentStoreBase implements WritableContentStore {
  constructor(protected readonly opts: StoreOptions = {}) {}

  /** What this store validates writes with: the instance's registry, else the core's. */
  protected get contentTypes(): ContentTypeRegistry {
    return this.opts.contentTypes ?? coreContentTypes;
  }

  // ---------- dialect-specific row operations ----------

  /** Rows of `type` known AND valid at `asOf`: tx_from ≤ asOf < tx_to and valid_from ≤ asOf < valid_to. */
  protected abstract selectValidAt(type: ContentType, asOf: Date): Promise<ContentRow[]>;
  /** Current assertions (tx_to IS NULL) of `type`, ordered by slug, lang. */
  protected abstract selectCurrent(type: ContentType): Promise<ContentRow[]>;
  /** The current assertion of one item, or null. */
  protected abstract selectCurrentOne(type: ContentType, slug: string, lang: string): Promise<ContentRow | null>;
  /** Every assertion ever made for one item, newest tx_from first. */
  protected abstract selectVersions(type: ContentType, slug: string, lang: string): Promise<ContentRow[]>;
  /**
   * Atomically close the current assertion (tx_to = at) and, when given,
   * insert the next one. `next = null` is a delete (tombstone).
   */
  protected abstract supersede(
    type: ContentType,
    slug: string,
    lang: string,
    at: Date,
    next: NewContentRow | null
  ): Promise<void>;

  // ---------- read side (ContentStore) ----------

  async getSiteConfig(opts?: ReadOptions): Promise<SiteConfig> {
    let rows = await this.currentRows("site", opts);
    // Before the site existed: the current config (see ContentStore.getSiteConfig).
    if (rows.length === 0 && opts?.asOf) rows = await this.currentRows("site");
    if (rows.length === 0) throw new Error("No site config in database (seed it first)");
    return SiteConfigSchema.parse(rows[0].data);
  }

  async listProducts(opts?: ReadOptions): Promise<Product[]> {
    const rows = await this.currentRows("product", opts);
    const products = rows.map((r) => ProductSchema.parse(r.data));
    return this.pickLang(products, opts?.lang).sort(
      (a, b) => a.order - b.order || a.slug.localeCompare(b.slug)
    );
  }

  async getProduct(slug: string, opts?: ReadOptions): Promise<Product | null> {
    return (await this.listProducts(opts)).find((p) => p.slug === slug) ?? null;
  }

  async listReleases(
    opts?: ReadOptions & { project?: string; product?: string }
  ): Promise<Release[]> {
    const rows = await this.currentRows("release", opts);
    let releases = rows.map((r) => ReleaseSchema.parse(r.data));
    if (opts?.project) releases = releases.filter((r) => r.project === opts.project);
    if (opts?.product) releases = releases.filter((r) => r.product === opts.product);
    const asOf = opts?.asOf ?? new Date();
    releases = releases.filter((r) => new Date(r.date) <= asOf);
    return releases.sort((a, b) => b.date.localeCompare(a.date));
  }

  async listComponents(opts?: ReadOptions): Promise<Component[]> {
    const rows = await this.currentRows("component", opts);
    const components = rows.map((r) => ComponentSchema.parse(r.data));
    return this.pickLang(components, opts?.lang).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getComponent(slug: string, opts?: ReadOptions): Promise<Component | null> {
    return (await this.listComponents(opts)).find((c) => c.slug === slug) ?? null;
  }

  async listBoardSpecs(
    opts?: ReadOptions & { component?: string }
  ): Promise<BoardSpec[]> {
    const rows = await this.currentRows("board-spec", opts);
    let specs = rows.map((r) => BoardSpecSchema.parse(r.data));
    if (opts?.component) specs = specs.filter((s) => s.component === opts.component);
    return this.pickLang(specs, opts?.lang).sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async getBoardSpec(slug: string, opts?: ReadOptions): Promise<BoardSpec | null> {
    return (await this.listBoardSpecs(opts)).find((s) => s.slug === slug) ?? null;
  }

  async listPages(opts?: ReadOptions & { prefix?: string }): Promise<Page[]> {
    const rows = await this.currentRows("page", opts);
    let pages = rows.map((r) => this.parsePage(r.data));
    const asOf = opts?.asOf ?? new Date();
    pages = pages.filter(
      (p) =>
        (opts?.includeDrafts || !p.draft) &&
        (!p.publishedAt || new Date(p.publishedAt) <= asOf)
    );
    if (opts?.prefix) pages = pages.filter((p) => p.slug.startsWith(opts.prefix!));
    return this.pickLang(pages, opts?.lang).sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
  }

  async getPage(slug: string, opts?: ReadOptions): Promise<Page | null> {
    return (await this.listPages(opts)).find((p) => p.slug === slug) ?? null;
  }

  async getMenu(name: string, opts?: ReadOptions): Promise<Menu | null> {
    const rows = await this.currentRows("menu", opts);
    const row = rows.find((r) => r.slug === name);
    return row ? MenuSchema.parse(row.data) : null;
  }

  async listThemes(opts?: ReadOptions): Promise<Theme[]> {
    const rows = await this.currentRows("theme", opts);
    return rows
      .map((r) => ThemeSchema.parse(r.data))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  // ---------- write side (WritableContentStore) ----------

  async listItems(type: ContentType): Promise<ContentRecord[]> {
    return (await this.selectCurrent(type)) as ContentRecord[];
  }

  async getItem(type: ContentType, slug: string, lang = "en"): Promise<ContentRecord | null> {
    return (await this.selectCurrentOne(type, slug, lang)) as ContentRecord | null;
  }

  async putItem(
    type: ContentType,
    slug: string,
    data: unknown,
    opts: { lang?: string; validFrom?: Date; validTo?: Date | null; by?: string } = {}
  ): Promise<void> {
    const parsed = this.validate(type, data);
    await this.checkReferences(type, parsed);
    const lang = opts.lang ?? "en";
    const now = new Date();
    await this.supersede(type, slug, lang, now, {
      type,
      slug,
      lang,
      data: parsed,
      validFrom: opts.validFrom ?? now,
      validTo: opts.validTo ?? null,
      txFrom: now,
      txTo: null,
      createdBy: opts.by ?? null,
    });
  }

  async deleteItem(type: ContentType, slug: string, lang = "en"): Promise<void> {
    await this.supersede(type, slug, lang, new Date(), null);
  }

  async listVersions(type: ContentType, slug: string, lang = "en"): Promise<ContentRecord[]> {
    return (await this.selectVersions(type, slug, lang)) as ContentRecord[];
  }

  // ---------- internals ----------

  /**
   * Assertions as known AND valid at `asOf` — both bitemporal axes (S6).
   * With `asOf` in the past this returns the rows that were current back then
   * (superseded/tombstoned since or not), so an as-of preview really time
   * travels; for `asOf` = now the tx-window clause is equivalent to
   * `tx_to IS NULL` (supersession always stamps txTo <= now).
   */
  private currentRows(type: ContentType, opts?: ReadOptions): Promise<ContentRow[]> {
    return this.selectValidAt(type, opts?.asOf ?? new Date());
  }

  /** EN as base, requested language overlaid per slug (S9). */
  private pickLang<T extends { slug: string; lang: string }>(
    items: T[],
    lang?: string
  ): T[] {
    const wanted = lang ?? "en";
    const bySlug = new Map<string, T>();
    for (const item of items.filter((i) => i.lang === "en")) bySlug.set(item.slug, item);
    if (wanted !== "en") {
      for (const item of items.filter((i) => i.lang === wanted)) bySlug.set(item.slug, item);
    }
    return [...bySlug.values()];
  }

  private parsePage(data: unknown): Page {
    const page = PageRecordSchema.parse(data);
    if (page.layout && this.opts.widgets) {
      return { ...page, layout: this.opts.widgets.parseLayout(page.layout) };
    }
    return page;
  }

  /**
   * Validate a payload with the type's registered schema (design/fase-5):
   * an unregistered type is refused, so nothing unknown is ever written. A
   * page's layout is checked against the widget registry as well.
   */
  private validate(type: ContentType, data: unknown): unknown {
    const parsed = this.contentTypes.validate(type, data);
    if (type === "page" && this.opts.widgets) {
      const page = parsed as { layout?: unknown };
      if (page.layout) this.opts.widgets.parseLayout(page.layout);
    }
    return parsed;
  }

  private async loadRelationRules(): Promise<RelationRule[]> {
    const item = await this.getItem("relations", "relations");
    return item ? RelationsDoc.parse(item.data).rules : [];
  }

  /**
   * Enforce referential integrity on write: any enforced reference must point
   * at content that exists. Skipped entirely when no rules are configured.
   */
  private async checkReferences(type: ContentType, data: unknown): Promise<void> {
    if (type === "relations") return;
    const rules = await this.loadRelationRules();
    if (rules.length === 0) return;
    const missing = await validateReferences(rules, type, data, async (toType) => {
      const items = await this.listItems(toType as ContentType);
      return new Set(items.map((i) => i.slug));
    });
    if (missing.length > 0) {
      const detail = missing.map((m) => `${m.field} → ${m.toType}/${m.slug}`).join(", ");
      throw new Error(`References not found: ${detail}`);
    }
  }
}
