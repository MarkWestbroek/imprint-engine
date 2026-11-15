import { promises as fs } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { ContentTypeRegistry, coreContentTypeDefinitions, PageDocSchema } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { widgetRegistry } from "../src/widgets/registry";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Put the named pages from `content/pages/` into the database, through the
 * WritableContentStore: each one becomes a new version, the history stays.
 * Only these pages; a full seed would supersede every page.
 *
 * Refuses a page whose latest version was made in the admin (not by the seed
 * or by this script), unless `--force`: the file would overwrite that edit.
 * Unchanged pages are skipped.
 *
 *   npm run put:pages --workspace=markwestbroek -- home woonwagen woonwagen/pl
 *   # on the VPS (from deploy/vps, after `docker compose build tools`):
 *   docker compose run --rm -e DATABASE_URL=… tools npm run put:pages --workspace=markwestbroek -- home
 */
const BY = "put-pages";
const OURS = new Set(["seed", BY]);

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const slugs = args.filter((a) => !a.startsWith("--"));
  if (!slugs.length) throw new Error("Which pages? e.g. put-pages home woonwagen woonwagen/pl");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No database (DATABASE_URL): nothing to change.");

  const opened = openContentDatabase(url, { widgets: widgetRegistry, contentTypes: ContentTypeRegistry.of(coreContentTypeDefinitions) });
  try {
    for (const slug of slugs) {
      const file = path.join(process.cwd(), "content", "pages", `${slug}.json`);
      const doc = PageDocSchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
      const current = await opened.store.getItem("page", doc.slug, doc.lang);
      if (current && JSON.stringify(current.data) === JSON.stringify(doc)) {
        console.log(`page ${doc.slug}: unchanged`);
        continue;
      }
      if (current && !OURS.has(current.createdBy ?? "") && !force) {
        console.log(`page ${doc.slug}: SKIPPED, last edited in the admin by ${current.createdBy}; --force overwrites that`);
        continue;
      }
      await opened.store.putItem("page", doc.slug, doc, { lang: doc.lang, by: BY });
      console.log(`page ${doc.slug}: new version`);
    }
  } finally {
    await opened.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
