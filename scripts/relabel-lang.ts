import "dotenv/config";

import { isLocale, LANGUAGE_TYPES, LEGACY_LOCALE, relabelLanguage } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";

/**
 * One-time, per site (design/meertaligheid.md §7 B): the content of a site
 * that got a base language is still labelled "en". This gives every such item
 * the base language instead, through the store, so the history stays right:
 * the item is asserted again under the new language and the "en" version ends.
 *
 *   npm run db:relabel-lang -- --to=nl            (DATABASE_URL of the site)
 *   npm run db:relabel-lang -- --to=nl --dry-run  (only says what it would do)
 *
 * Only the types that have a language (page, product, component, board-spec).
 * Idempotent: an item that already exists in the base language is left alone.
 * Run it before the site is built with `defaultLocale` in its config.
 */

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const to = arg("to");
  if (!isLocale(to)) throw new Error("Give the base language: --to=nl");
  if (to === LEGACY_LOCALE) throw new Error(`Nothing to do: "${LEGACY_LOCALE}" is the label the content already has`);
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // No registries: the data is asserted again as it is, a relabel changes no content.
  const opened = openContentDatabase(url);
  try {
    for (const type of LANGUAGE_TYPES) {
      const done = await relabelLanguage(opened.store, type, to, { dryRun, by: "relabel-lang" });
      for (const slug of done.relabelled) console.log(`${type.padEnd(10)} ${dryRun ? "would relabel" : "✓"} ${slug} (en → ${to})`);
      for (const slug of done.skipped) console.log(`${type.padEnd(10)} – ${slug}: exists in ${to} already, "en" left as it is`);
    }
  } finally {
    await opened.close();
  }
  if (!dryRun) console.log("Done. Build the site now: this does not empty the Next cache.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
