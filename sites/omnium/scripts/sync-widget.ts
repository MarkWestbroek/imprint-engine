import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ContentTypeRegistry, coreContentTypeDefinitions } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { widgetRegistry } from "../src/widgets/registry";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * One block from content/ into the database, nothing else: a correction made
 * in the repository reaches the live page without overwriting what the
 * editors changed elsewhere on it. The block is found by its title, on both
 * sides; its config is replaced (its editors' note stays). A block the
 * database page does not have yet is added as a new row at the end. Through the
 * WritableContentStore, so the page gets a new version in its history.
 *
 *   npm run content:sync-widget --workspace=omnium -- register "Hoe het is opgebouwd"
 */
type Widget = { type: string; config: { title?: string } & Record<string, unknown>; note?: string };
type Layout = { rows: { cells: { span?: number; widgets: Widget[] }[] }[] };

/** Equal regardless of key order (the store may write the fields in another order). */
const sorted = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sorted(x)])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

const find = (layout: Layout, title: string) =>
  layout.rows.flatMap((r) => r.cells.flatMap((c) => c.widgets)).filter((w) => w.config?.title === title);

async function main() {
  const [slug, title] = process.argv.slice(2);
  if (!slug || !title) throw new Error('Usage: sync-widget <page slug> "<block title>"');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No database (DATABASE_URL).");

  const file = JSON.parse(await fs.readFile(path.join(process.cwd(), "content", "pages", `${slug}.json`), "utf8")) as { layout: Layout };
  const source = find(file.layout, title);
  if (source.length !== 1) throw new Error(`content/pages/${slug}.json: ${source.length} blocks titled "${title}" (expected 1)`);

  const opened = openContentDatabase(url, { widgets: widgetRegistry, contentTypes: ContentTypeRegistry.of(coreContentTypeDefinitions) });
  try {
    const record = await opened.store.getItem("page", slug);
    if (!record) throw new Error(`No page "${slug}" in the database.`);
    const doc = structuredClone(record.data) as { layout: Layout };
    const target = find(doc.layout, title);
    if (target.length === 0) {
      doc.layout.rows.push({ cells: [{ span: 1, widgets: [{ type: source[0]!.type, config: source[0]!.config }] }] });
      await opened.store.putItem("page", slug, doc, { by: "sync-widget" });
      console.log(`"${title}" on ${slug}: added at the end (new version)`);
      return;
    }
    if (target.length !== 1) throw new Error(`Database page "${slug}": ${target.length} blocks titled "${title}" (expected 1); change it in the studio.`);
    if (same(target[0]!.config, source[0]!.config)) {
      console.log(`"${title}" on ${slug}: already the same`);
      return;
    }
    target[0]!.config = source[0]!.config;
    await opened.store.putItem("page", slug, doc, { by: "sync-widget" });
    console.log(`"${title}" on ${slug}: updated (new version)`);
  } finally {
    await opened.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
