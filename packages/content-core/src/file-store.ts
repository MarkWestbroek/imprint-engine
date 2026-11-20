import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import {
  BoardSpecSchema,
  ComponentSchema,
  MenuSchema,
  PageDocSchema,
  PageMetaSchema,
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
import { LEGACY_LOCALE, pickByLang } from "./lang";
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
 *
 * A file that names no `lang` is in the site's base language (`defaultLocale`,
 * absent = "en"); reads pick per slug as the database stores do (lang.ts).
 */
export class FileContentStore implements ContentStore {
  constructor(
    private readonly contentDir: string,
    private readonly opts: { widgets?: WidgetTypeRegistry; defaultLocale?: string } = {}
  ) {}

  private get defaultLocale(): string {
    return this.opts.defaultLocale ?? LEGACY_LOCALE;
  }

  /** A file without `lang` is written in the site's base language. */
  private inBaseLang(data: unknown): unknown {
    return data && typeof data === "object" && !("lang" in data) ? { ...data, lang: this.defaultLocale } : data;
  }

  /** One file, no history: `asOf` has nothing to select between. */
  async getSiteConfig(_opts?: ReadOptions): Promise<SiteConfig> {
    const raw = await fs.readFile(path.join(this.contentDir, "site.json"), "utf8");
    return SiteConfigSchema.parse(JSON.parse(raw));
  }

  async listProducts(opts?: ReadOptions): Promise<Product[]> {
    const files = await this.listFiles("products", ".json");
    const products: Product[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      products.push(ProductSchema.parse(this.inBaseLang(JSON.parse(raw))));
    }
    const picked = pickByLang(products, opts?.lang, this.defaultLocale);
    return picked.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  }

  async getProduct(slug: string, opts?: ReadOptions): Promise<Product | null> {
    const products = await this.listProducts(opts);
    return products.find((p) => p.slug === slug) ?? null;
  }

  async listReleases(
    opts?: ReadOptions & { project?: string; product?: string }
  ): Promise<Release[]> {
    const files = await this.listFiles("releases", ".json");
    let releases: Release[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      releases.push(ReleaseSchema.parse(JSON.parse(raw)));
    }
    if (opts?.project) releases = releases.filter((r) => r.project === opts.project);
    if (opts?.product) releases = releases.filter((r) => r.product === opts.product);
    const asOf = opts?.asOf ?? new Date();
    releases = releases.filter((r) => new Date(r.date) <= asOf);
    return releases.sort((a, b) => b.date.localeCompare(a.date));
  }

  async listComponents(opts?: ReadOptions): Promise<Component[]> {
    const files = await this.listFiles("components", ".json");
    const components: Component[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      components.push(ComponentSchema.parse(this.inBaseLang(JSON.parse(raw))));
    }
    const picked = pickByLang(components, opts?.lang, this.defaultLocale);
    return picked.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getComponent(slug: string, opts?: ReadOptions): Promise<Component | null> {
    return (await this.listComponents(opts)).find((c) => c.slug === slug) ?? null;
  }

  async listBoardSpecs(
    opts?: ReadOptions & { component?: string }
  ): Promise<BoardSpec[]> {
    const files = await this.listFiles("board-specs", ".json");
    const specs: BoardSpec[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      specs.push(BoardSpecSchema.parse(this.inBaseLang(JSON.parse(raw))));
    }
    const picked = pickByLang(specs, opts?.lang, this.defaultLocale);
    let out = picked;
    if (opts?.component) out = out.filter((s) => s.component === opts.component);
    return out.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async getBoardSpec(slug: string, opts?: ReadOptions): Promise<BoardSpec | null> {
    return (await this.listBoardSpecs(opts)).find((s) => s.slug === slug) ?? null;
  }

  async listPages(opts?: ReadOptions & { prefix?: string }): Promise<Page[]> {
    const pages: Page[] = [];
    for (const file of await this.listFiles("pages", ".md", true)) {
      const raw = await fs.readFile(file, "utf8");
      const { data, content } = matter(raw);
      pages.push({ ...PageMetaSchema.parse(this.inBaseLang(data)), body: content.trim() });
    }
    for (const file of await this.listFiles("pages", ".json", true)) {
      const raw = await fs.readFile(file, "utf8");
      const doc = PageDocSchema.parse(this.inBaseLang(JSON.parse(raw)));
      const layout = this.opts.widgets
        ? this.opts.widgets.parseLayout(doc.layout)
        : doc.layout;
      pages.push({ ...doc, layout });
    }
    const asOf = opts?.asOf ?? new Date();

    let visible = pages.filter(
      (p) =>
        (opts?.includeDrafts || !p.draft) &&
        (!p.publishedAt || new Date(p.publishedAt) <= asOf)
    );
    if (opts?.prefix) visible = visible.filter((p) => p.slug.startsWith(opts.prefix!));

    return pickByLang(visible, opts?.lang, this.defaultLocale).sort((a, b) =>
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

  async listThemes(): Promise<Theme[]> {
    const files = await this.listFiles("themes", ".json");
    const themes: Theme[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      themes.push(ThemeSchema.parse(JSON.parse(raw)));
    }
    return themes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
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
