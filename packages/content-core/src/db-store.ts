import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { z } from "zod";

import { contentItems, users } from "./db-schema";
import {
  BoardSpecSchema,
  ComponentSchema,
  MenuSchema,
  PageMetaSchema,
  PlanningSchema,
  PlanningItemSchema,
  WikiSchema,
  WikiFolderSchema,
  WikiPageSchema,
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
import { PageLayoutSchema, type WidgetTypeRegistry } from "./widgets";
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

/** Page payload as stored: meta + markdown body and/or a widget layout. */
const PageRecordSchema = PageMetaSchema.extend({
  body: z.string().default(""),
  layout: PageLayoutSchema.optional(),
});

export type Db = MySql2Database & { $client: mysql.Pool };

/** One pool per process; Next.js dev reloads modules, so keep it lazy. */
export function createDb(url: string): Db {
  const pool = mysql.createPool({ uri: url, connectionLimit: 5 });
  return drizzle(pool) as Db;
}

export { contentItems, users };

/**
 * Database-backed ContentStore (v1, bitemporal-light §B3) plus the write
 * side for the admin. Same read semantics as the file store: language
 * fallback to "en" (S9), drafts hidden unless asked (S5), asOf respected
 * via valid time (S6).
 */
export class DbContentStore implements WritableContentStore {
  constructor(
    private readonly db: Db,
    private readonly opts: { widgets?: WidgetTypeRegistry } = {}
  ) {}

  /**
   * MariaDB's JSON type is an alias for LONGTEXT, so mysql2 hands the payload
   * back as a string (real MySQL parses it). Normalize on every read.
   */
  private static thaw<T extends { data: unknown }>(row: T): T {
    return typeof row.data === "string" ? { ...row, data: JSON.parse(row.data) } : row;
  }

  // ---------- read side (ContentStore) ----------

  async getSiteConfig(): Promise<SiteConfig> {
    const rows = await this.currentRows("site");
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
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.type, type), isNull(contentItems.txTo)))
      .orderBy(contentItems.slug, contentItems.lang);
    return rows.map(DbContentStore.thaw) as ContentRecord[];
  }

  async getItem(type: ContentType, slug: string, lang = "en"): Promise<ContentRecord | null> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.type, type),
          eq(contentItems.slug, slug),
          eq(contentItems.lang, lang),
          isNull(contentItems.txTo)
        )
      )
      .limit(1);
    return rows[0] ? (DbContentStore.thaw(rows[0]) as ContentRecord) : null;
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
    await this.db.transaction(async (tx) => {
      await tx
        .update(contentItems)
        .set({ txTo: now })
        .where(
          and(
            eq(contentItems.type, type),
            eq(contentItems.slug, slug),
            eq(contentItems.lang, lang),
            isNull(contentItems.txTo)
          )
        );
      await tx.insert(contentItems).values({
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
    });
  }

  async deleteItem(type: ContentType, slug: string, lang = "en"): Promise<void> {
    await this.db
      .update(contentItems)
      .set({ txTo: new Date() })
      .where(
        and(
          eq(contentItems.type, type),
          eq(contentItems.slug, slug),
          eq(contentItems.lang, lang),
          isNull(contentItems.txTo)
        )
      );
  }

  async listVersions(type: ContentType, slug: string, lang = "en"): Promise<ContentRecord[]> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.type, type),
          eq(contentItems.slug, slug),
          eq(contentItems.lang, lang)
        )
      )
      .orderBy(desc(contentItems.txFrom));
    return rows.map(DbContentStore.thaw) as ContentRecord[];
  }

  // ---------- internals ----------

  /**
   * Assertions as known AND valid at `asOf` — both bitemporal axes (S6).
   * With `asOf` in the past this returns the rows that were current back then
   * (superseded/tombstoned since or not), so an as-of preview really time
   * travels; for `asOf` = now the tx-window clause is equivalent to
   * `tx_to IS NULL` (supersession always stamps txTo <= now).
   */
  private async currentRows(type: ContentType, opts?: ReadOptions) {
    const asOf = opts?.asOf ?? new Date();
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.type, type),
          lte(contentItems.txFrom, asOf),
          or(isNull(contentItems.txTo), gt(contentItems.txTo, asOf)),
          lte(contentItems.validFrom, asOf),
          or(isNull(contentItems.validTo), gt(contentItems.validTo, asOf))
        )
      );
    return rows.map(DbContentStore.thaw);
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

  private validate(type: ContentType, data: unknown): unknown {
    switch (type) {
      case "site":
        return SiteConfigSchema.parse(data);
      case "product":
        return ProductSchema.parse(data);
      case "component":
        return ComponentSchema.parse(data);
      case "board-spec":
        return BoardSpecSchema.parse(data);
      case "release":
        return ReleaseSchema.parse(data);
      case "menu":
        return MenuSchema.parse(data);
      case "theme":
        return ThemeSchema.parse(data);
      case "planning":
        return PlanningSchema.parse(data);
      case "planning-item":
        return PlanningItemSchema.parse(data);
      case "wiki":
        return WikiSchema.parse(data);
      case "wiki-folder":
        return WikiFolderSchema.parse(data);
      case "wiki-page":
        return WikiPageSchema.parse(data);
      case "relations":
        return RelationsDoc.parse(data);
      case "page": {
        const page = PageRecordSchema.parse(data);
        if (page.layout && this.opts.widgets) this.opts.widgets.parseLayout(page.layout);
        return page;
      }
      default:
        throw new Error(`Unknown content type "${String(type satisfies never)}"`);
    }
  }

  /** The configurable relation rules (content type "relations", slug "relations"). */
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
