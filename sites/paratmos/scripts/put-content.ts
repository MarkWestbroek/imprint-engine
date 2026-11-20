import { promises as fs } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { ContentTypeRegistry, coreContentTypeDefinitions, PageDocSchema, SiteConfigSchema } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { blogContentTypes } from "@imprint/plugin-blog/content-types"; // React-free entries: this runs under tsx, not Next
import { glossaryContentTypes } from "@imprint/plugin-glossary/content-types";
import { wikiContentTypes } from "@imprint/plugin-wiki/content-types";
import { widgetRegistry } from "../src/widgets/registry";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Put the starting content from `content/` into the database, through the
 * WritableContentStore: each changed item becomes a new version, the history
 * stays. Pages come from `content/pages/`, the plugins' content (which the
 * root seed does not know) from `content/items/<type>/<slug>.json`: the wiki
 * with its folders and pages, the glossary terms and the posts.
 *
 * Refuses an item whose latest version was made in the admin (not by the seed
 * or by this script), unless `--force`: the file would overwrite that edit.
 * Unchanged items are skipped. Site config and menu go through the root seed
 * (`npm run db:seed -- --site=paratmos --only=site,menu --lang=nl`).
 *
 *   npm run put:content --workspace=paratmos                  # everything
 *   npm run put:content --workspace=paratmos -- page post     # only these types
 *   # on the VPS (from deploy/vps, after `docker compose build tools`):
 *   docker compose run --rm -e DATABASE_URL=… tools npm run put:content --workspace=paratmos
 */
const BY = "put-content";
const OURS = new Set(["seed", BY]);
/** In this order: a folder needs its wiki, a page its folder (enforced relations). */
const ITEM_TYPES = ["wiki", "wiki-folder", "wiki-page", "term", "post"];

/** JSON with the keys in a fixed order and without absent values: Postgres (jsonb) returns a document's keys in its own order. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        )
      : v
  );
}

async function jsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => path.join(e.parentPath ?? dir, e.name))
      .sort();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((a) => !a.startsWith("--"));
  const want = (type: string) => only.length === 0 || only.includes(type);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No database (DATABASE_URL): nothing to change.");

  const contentTypes = ContentTypeRegistry.of(coreContentTypeDefinitions, wikiContentTypes, glossaryContentTypes, blogContentTypes);
  const content = path.join(process.cwd(), "content");
  // The site's base language (defaultLocale in imprint.config.ts; site.json carries the same value, and this
  // script reads it there so it needs no React imports). A page file without `lang` is in it, as with the
  // seed's --lang; the store reads and writes pages in it. The plugins' types have no language of their own.
  const baseLang = SiteConfigSchema.parse(JSON.parse(await fs.readFile(path.join(content, "site.json"), "utf8"))).defaultLocale;
  const opened = openContentDatabase(url, { widgets: widgetRegistry, contentTypes, defaultLocale: baseLang });

  async function put(type: string, doc: { slug: string; lang?: string }) {
    const current = await opened.store.getItem(type, doc.slug, doc.lang);
    if (current && stable(current.data) === stable(doc)) return console.log(`${type} ${doc.slug}: unchanged`);
    if (current && !OURS.has(current.createdBy ?? "") && !force) {
      return console.log(`${type} ${doc.slug}: SKIPPED, last edited in the admin by ${current.createdBy}; --force overwrites that`);
    }
    await opened.store.putItem(type, doc.slug, doc, { lang: doc.lang, by: BY });
    console.log(`${type} ${doc.slug}: new version`);
  }

  try {
    if (want("page")) {
      for (const file of await jsonFiles(path.join(content, "pages"))) {
        const raw = JSON.parse(await fs.readFile(file, "utf8"));
        const doc = PageDocSchema.parse({ lang: baseLang, ...raw });
        // With the widgets' defaults filled in, as the store keeps it: otherwise every page looks changed.
        const page = { ...doc, layout: doc.layout && widgetRegistry.parseLayout(doc.layout) };
        await put("page", page);
      }
    }
    for (const type of ITEM_TYPES.filter(want)) {
      const def = contentTypes.get(type);
      for (const file of await jsonFiles(path.join(content, "items", type))) {
        // Parsed with the type's schema, so the stored document carries the defaults (lang, order, …).
        await put(type, def.schema.parse(JSON.parse(await fs.readFile(file, "utf8"))) as { slug: string; lang?: string });
      }
    }
  } finally {
    await opened.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
