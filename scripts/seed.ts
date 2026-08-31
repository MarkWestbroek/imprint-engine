import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import {
  DEFAULT_RELATION_RULES,
  MenuSchema,
  PageMetaSchema,
  PageDocSchema,
  ProductSchema,
  ReleaseSchema,
  SiteConfigSchema,
  ThemeSchema,
} from "@imprint/content-core";
import { createDb, DbContentStore } from "@imprint/content-core/db-store";
import { DbUserStore } from "@imprint/content-core/user-store";

/**
 * One-time (idempotent) import: the v0 content files → database, plus the
 * first admin user. Existing slugs are superseded, not duplicated — running
 * this twice just adds a version to the history.
 *
 * `--only=<types>` seeds a subset (comma-separated: site, product, release,
 * page, menu, theme, relations, planning, user) — e.g. `--only=themes` to add
 * the themes to an existing database without touching edited content, or
 * `--only=relations` to (re)load the default relation rules.
 */

const siteArg = process.argv.find((a) => a.startsWith("--site="))?.slice(7) ?? "musicbrain";
const CONTENT_DIR = path.join(process.cwd(), "sites", siteArg, "content");

const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const only = onlyArg
  ? new Set(onlyArg.split(",").map((s) => s.trim().replace(/s$/, "")))
  : null;
/** Should this section run? (no --only = everything). Singularise both sides
 * so `--only=relations` (plural) matches the `want("relations")` call. */
const want = (type: string) => !only || only.has(type.replace(/s$/, ""));

async function json(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function listFiles(dir: string, ext: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(ext))
      .map((e) => path.join(e.parentPath ?? dir, e.name));
  } catch {
    return [];
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (create .env from .env.example)");
  const db = createDb(url);
  const store = new DbContentStore(db);
  const by = "seed";

  // site config
  if (want("site")) {
    const site = SiteConfigSchema.parse(await json(path.join(CONTENT_DIR, "site.json")));
    await store.putItem("site", "site", site, { by });
    console.log("site      ✓ site.json");
  }

  // products
  if (want("product")) {
    for (const file of await listFiles(path.join(CONTENT_DIR, "products"), ".json")) {
      const product = ProductSchema.parse(await json(file));
      await store.putItem("product", product.slug, product, { lang: product.lang, by });
      console.log(`product   ✓ ${product.slug} (${product.lang})`);
    }
  }

  // releases — slug = project-version
  if (want("release")) {
    for (const file of await listFiles(path.join(CONTENT_DIR, "releases"), ".json")) {
      const release = ReleaseSchema.parse(await json(file));
      const slug = `${release.project}-${release.version}`;
      await store.putItem("release", slug, release, { by });
      console.log(`release   ✓ ${slug}`);
    }
  }

  if (want("page")) {
    // markdown pages: publishedAt doubles as valid_from (S6)
    for (const file of await listFiles(path.join(CONTENT_DIR, "pages"), ".md")) {
      const { data, content } = matter(await fs.readFile(file, "utf8"));
      const meta = PageMetaSchema.parse(data);
      await store.putItem(
        "page",
        meta.slug,
        { ...meta, body: content.trim() },
        {
          lang: meta.lang,
          validFrom: meta.publishedAt ? new Date(meta.publishedAt) : undefined,
          by,
        }
      );
      console.log(`page      ✓ ${meta.slug} (${meta.lang})`);
    }

    // composed pages (widget layouts)
    for (const file of await listFiles(path.join(CONTENT_DIR, "pages"), ".json")) {
      const doc = PageDocSchema.parse(await json(file));
      await store.putItem("page", doc.slug, doc, { lang: doc.lang, by });
      console.log(`page      ✓ ${doc.slug} (${doc.lang}, layout)`);
    }
  }

  // menus
  if (want("menu")) {
    for (const file of await listFiles(path.join(CONTENT_DIR, "menus"), ".json")) {
      const menu = MenuSchema.parse(await json(file));
      await store.putItem("menu", menu.name, menu, { by });
      console.log(`menu      ✓ ${menu.name}`);
    }
  }

  // themes
  if (want("theme")) {
    for (const file of await listFiles(path.join(CONTENT_DIR, "themes"), ".json")) {
      const theme = ThemeSchema.parse(await json(file));
      await store.putItem("theme", theme.name, theme, { by });
      console.log(`theme     ✓ ${theme.name}`);
    }
  }

  // relation rules (referential integrity between content types)
  if (want("relations")) {
    await store.putItem("relations", "relations", { rules: DEFAULT_RELATION_RULES }, { by });
    console.log(`relations ✓ ${DEFAULT_RELATION_RULES.length} default rules`);
  }

  // demo planning board (dynamic content; a starting example of the feature)
  if (want("planning")) {
    const owner = process.env.SEED_ADMIN_USER ?? "admin";
    await store.putItem(
      "planning",
      "roadmap",
      {
        slug: "roadmap",
        name: "Planning",
        product: "cortex",
        description: "Van idee tot geproduceerd bord.",
        phases: [
          { key: "backlog", label: "Backlog", order: 0 },
          { key: "onderhanden", label: "Onderhanden", order: 1 },
          { key: "beta", label: "Bestelbaar / beta", order: 2 },
          { key: "live", label: "Geproduceerd / live", order: 3 },
        ],
      },
      { by }
    );

    // Only link components that actually exist, so a fresh (file-only) seed
    // doesn't trip referential integrity.
    const haveComponents = new Set((await store.listItems("component")).map((c) => c.slug));
    const link = (slug: string, version?: string) =>
      haveComponents.has(slug) ? { component: slug, ...(version && { componentVersion: version }) } : {};

    const cards: { slug: string; title: string; status: string; body?: string; comp?: [string, string?] }[] = [
      { slug: "roadmap-vcf8", title: "VCF8 module", status: "backlog", body: "8-kanaals filter — ontwerpfase." },
      { slug: "roadmap-vca8", title: "VCA8 module", status: "onderhanden", body: "Layout bijna rond." },
      { slug: "roadmap-busboard", title: "Busboard", status: "beta", comp: ["busboard-v2", "v2.0"] },
      { slug: "roadmap-adc8", title: "ADC8", status: "beta", comp: ["adc8", "v1.2"] },
      { slug: "roadmap-dac8", title: "DAC8", status: "beta", comp: ["dac8"] },
      { slug: "roadmap-website", title: "MusicBrain website", status: "live", body: "De site die je nu bekijkt." },
    ];
    let order = 0;
    let prevStatus = "";
    for (const c of cards) {
      if (c.status !== prevStatus) { order = 0; prevStatus = c.status; }
      await store.putItem(
        "planning-item",
        c.slug,
        {
          slug: c.slug,
          title: c.title,
          planning: "roadmap",
          status: c.status,
          owner,
          body: c.body ?? "",
          order: order++,
          ...(c.comp ? link(c.comp[0], c.comp[1]) : {}),
        },
        { by }
      );
    }
    console.log(`planning  ✓ roadmap (${cards.length} cards)`);
  }

  // first admin user — later ones go through /admin/users or `npm run user`
  if (want("user")) {
    const name = process.env.SEED_ADMIN_USER ?? "admin";
    const password = process.env.SEED_ADMIN_PASSWORD;
    const userStore = new DbUserStore(db);
    if (!password) {
      console.log("user      ! SEED_ADMIN_PASSWORD empty — no admin user created");
    } else if (await userStore.get(name)) {
      console.log(`user      = ${name} already exists, skipped`);
    } else {
      await userStore.create(name, password, "admin");
      console.log(`user      ✓ ${name} (admin)`);
    }
  }

  await db.$client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
