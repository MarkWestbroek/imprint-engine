import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import {
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
 */

const CONTENT_DIR = path.join(process.cwd(), "sites", "musicbrain", "content");

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
  const site = SiteConfigSchema.parse(await json(path.join(CONTENT_DIR, "site.json")));
  await store.putItem("site", "site", site, { by });
  console.log("site      ✓ site.json");

  // products
  for (const file of await listFiles(path.join(CONTENT_DIR, "products"), ".json")) {
    const product = ProductSchema.parse(await json(file));
    await store.putItem("product", product.slug, product, { lang: product.lang, by });
    console.log(`product   ✓ ${product.slug} (${product.lang})`);
  }

  // releases — slug = project-version
  for (const file of await listFiles(path.join(CONTENT_DIR, "releases"), ".json")) {
    const release = ReleaseSchema.parse(await json(file));
    const slug = `${release.project}-${release.version}`;
    await store.putItem("release", slug, release, { by });
    console.log(`release   ✓ ${slug}`);
  }

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

  // menus
  for (const file of await listFiles(path.join(CONTENT_DIR, "menus"), ".json")) {
    const menu = MenuSchema.parse(await json(file));
    await store.putItem("menu", menu.name, menu, { by });
    console.log(`menu      ✓ ${menu.name}`);
  }

  // themes
  for (const file of await listFiles(path.join(CONTENT_DIR, "themes"), ".json")) {
    const theme = ThemeSchema.parse(await json(file));
    await store.putItem("theme", theme.name, theme, { by });
    console.log(`theme     ✓ ${theme.name}`);
  }

  // first admin user — later ones go through /admin/users or `npm run user`
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

  await db.$client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
