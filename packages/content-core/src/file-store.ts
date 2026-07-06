import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import {
  MenuSchema,
  PageDocSchema,
  PageMetaSchema,
  ProductSchema,
  ReleaseSchema,
  SiteConfigSchema,
  type Menu,
  type Page,
  type Product,
  type Release,
  type SiteConfig,
} from "./schemas";
import type { WidgetTypeRegistry } from "./widgets";
import type { ContentStore, ReadOptions } from "./store";

/**
 * File-backed ContentStore (v0). Content layout, relative to `contentDir`:
 *
 *   site.json                 SiteConfig
 *   products/<slug>.json      Product (or <slug>.<lang>.json for translations)
 *   releases/<file>.json      Release
 *   pages/<slug>.md           Page: frontmatter (PageMeta) + markdown body
 *   pages/<slug>.json         Composed page: meta + PageLayout with widgets
 *   pages/posts/<slug>.md     Devlog posts (just pages under a prefix)
 *   menus/<name>.json         Menu (nestable items pointing to pages/URLs)
 *
 * Everything is validated with zod on read, so a broken file fails the build
 * instead of silently rendering garbage. Pass the site's WidgetTypeRegistry
 * to also validate widget configs against their declared schemas.
 */
export class FileContentStore implements ContentStore {
  constructor(
    private readonly contentDir: string,
    private readonly opts: { widgets?: WidgetTypeRegistry } = {}
  ) {}

  async getSiteConfig(): Promise<SiteConfig> {
    const raw = await fs.readFile(path.join(this.contentDir, "site.json"), "utf8");
    return SiteConfigSchema.parse(JSON.parse(raw));
  }

  async listProducts(opts?: ReadOptions): Promise<Product[]> {
    const files = await this.listFiles("products", ".json");
    const products: Product[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      products.push(ProductSchema.parse(JSON.parse(raw)));
    }
    const lang = opts?.lang ?? "en";
    const bySlug = new Map<string, Product>();
    for (const p of products.filter((p) => p.lang === "en")) bySlug.set(p.slug, p);
    if (lang !== "en") {
      for (const p of products.filter((p) => p.lang === lang)) bySlug.set(p.slug, p);
    }
    return [...bySlug.values()].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  }

  async getProduct(slug: string, opts?: ReadOptions): Promise<Product | null> {
    const products = await this.listProducts(opts);
    return products.find((p) => p.slug === slug) ?? null;
  }

  async listReleases(opts?: ReadOptions & { project?: string }): Promise<Release[]> {
    const files = await this.listFiles("releases", ".json");
    let releases: Release[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      releases.push(ReleaseSchema.parse(JSON.parse(raw)));
    }
    if (opts?.project) releases = releases.filter((r) => r.project === opts.project);
    const asOf = opts?.asOf ?? new Date();
    releases = releases.filter((r) => new Date(r.date) <= asOf);
    return releases.sort((a, b) => b.date.localeCompare(a.date));
  }

  async listPages(opts?: ReadOptions & { prefix?: string }): Promise<Page[]> {
    const pages: Page[] = [];
    for (const file of await this.listFiles("pages", ".md", true)) {
      const raw = await fs.readFile(file, "utf8");
      const { data, content } = matter(raw);
      pages.push({ ...PageMetaSchema.parse(data), body: content.trim() });
    }
    for (const file of await this.listFiles("pages", ".json", true)) {
      const raw = await fs.readFile(file, "utf8");
      const doc = PageDocSchema.parse(JSON.parse(raw));
      const layout = this.opts.widgets
        ? this.opts.widgets.parseLayout(doc.layout)
        : doc.layout;
      pages.push({ ...doc, layout });
    }
    const lang = opts?.lang ?? "en";
    const asOf = opts?.asOf ?? new Date();

    let visible = pages.filter(
      (p) =>
        (opts?.includeDrafts || !p.draft) &&
        (!p.publishedAt || new Date(p.publishedAt) <= asOf)
    );
    if (opts?.prefix) visible = visible.filter((p) => p.slug.startsWith(opts.prefix!));

    const bySlug = new Map<string, Page>();
    for (const p of visible.filter((p) => p.lang === "en")) bySlug.set(p.slug, p);
    if (lang !== "en") {
      for (const p of visible.filter((p) => p.lang === lang)) bySlug.set(p.slug, p);
    }
    return [...bySlug.values()].sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
  }

  async getPage(slug: string, opts?: ReadOptions): Promise<Page | null> {
    const pages = await this.listPages(opts);
    return pages.find((p) => p.slug === slug) ?? null;
  }

  async getMenu(name: string): Promise<Menu | null> {
    try {
      const raw = await fs.readFile(
        path.join(this.contentDir, "menus", `${name}.json`),
        "utf8"
      );
      return MenuSchema.parse(JSON.parse(raw));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  private async listFiles(subdir: string, ext: string, recursive = false): Promise<string[]> {
    const dir = path.join(this.contentDir, subdir);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true, recursive });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith(ext))
        .map((e) => path.join(e.parentPath ?? dir, e.name));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}
