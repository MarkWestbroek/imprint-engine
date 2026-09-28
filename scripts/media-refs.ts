import "dotenv/config";
import { ASSET_REF_PREFIX, ContentTypeRegistry, coreContentTypeDefinitions } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { planningContentTypes } from "@imprint/plugin-planning/content-types"; // React-free entries: this runs under tsx
import { wikiContentTypes } from "@imprint/plugin-wiki/content-types";

/**
 * Turn links to media-library files into asset references
 * (design/beeldbibliotheek.md §3, step 3): a field whose whole value is a URL
 * like `/api/assets/library/<slug>/w1600.ab12cd34.webp` (copied from the
 * library's Formats list) becomes `asset:<slug>`. The page then shows the
 * asset's current public version and alt text, and "Used in" knows it.
 *
 * Only whole field values are changed — a link inside markdown text stays as
 * it is (markdown has no way to resolve a reference). Writes go through the
 * store: every change is a new version, visible in History.
 *
 *   npm run media:refs              show what would change (default)
 *   npm run media:refs -- --apply   change it
 */
const apply = process.argv.includes("--apply");
const base = (process.env.ASSET_BASE_URL || "/api/assets").replace(/\/$/, "");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Relative or absolute (https://site/api/assets/library/…), the whole value.
const LIBRARY_URL = new RegExp(`^(?:https?://[^/]+)?${escapeRe(base)}/library/([a-z0-9][a-z0-9-]*)/[^/]+$`);

type Change = { path: string; from: string; to: string };

/** A copy of `value` with library URLs replaced; `changes` collects what was replaced. */
function rewrite(value: unknown, path: string, changes: Change[]): unknown {
  if (typeof value === "string") {
    const m = LIBRARY_URL.exec(value);
    if (!m) return value;
    const to = ASSET_REF_PREFIX + m[1];
    changes.push({ path, from: value, to });
    return to;
  }
  if (Array.isArray(value)) return value.map((v, i) => rewrite(v, `${path}[${i}]`, changes));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, path ? `${path}.${k}` : k, changes)]));
  }
  return value;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const contentTypes = ContentTypeRegistry.of(coreContentTypeDefinitions, planningContentTypes, wikiContentTypes);
  const opened = openContentDatabase(url, { contentTypes });
  const store = opened.store;
  let items = 0;
  let fields = 0;
  try {
    for (const type of contentTypes.names()) {
      if (type === "asset") continue;
      for (const item of await store.listItems(type)) {
        const changes: Change[] = [];
        const next = rewrite(item.data, "", changes);
        if (changes.length === 0) continue;
        items++;
        fields += changes.length;
        console.log(`${type}/${item.slug} (${item.lang})`);
        for (const c of changes) console.log(`  ${c.path}: ${c.from} → ${c.to}`);
        if (apply) await store.putItem(type, item.slug, next, { lang: item.lang, by: "media-refs" });
      }
    }
  } finally {
    await opened.close();
  }
  console.log(
    fields === 0
      ? "No links to library files found."
      : `${fields} field(s) in ${items} item(s) ${apply ? "changed" : "would change — run with --apply to change them"}.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
