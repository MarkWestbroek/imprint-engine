import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ContentTypeRegistry, coreContentTypeDefinitions } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
// React-free entries of the plugin: this runs under tsx, not Next.
import { taalContentTypes } from "@imprint/plugin-taal/content-types";
import { importGrammatica, importLes, parseGrammatica, parseLes } from "@imprint/plugin-taal/import";
import { widgetRegistry } from "../src/widgets/registry";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Lesson files (Markdown with frontmatter) into the database as lessons,
 * through the WritableContentStore, and with them the grammar topics under
 * grammatica/ (first, so the lessons' links have something to point at). Run it again after editing a file: an
 * unchanged lesson gets no new version, and the recordings a lesson already
 * has stay (a changed sentence simply has no recording until Audio is run).
 *
 *   npm run import:lessen --workspace=taal                  # the five lessons of phase 0
 *   npm run import:lessen --workspace=taal -- <dir> [--dry-run]
 *
 * Lessons edited in the admin are overwritten by their file: after the first
 * import, pick one place to edit a lesson.
 */
const DEFAULT_DIR = path.resolve(import.meta.dirname, "../lessen");
const GRAMMATICA_DIR = path.resolve(import.meta.dirname, "../grammatica");

async function mdFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir, { recursive: true }).catch(() => [] as string[]);
  return files.filter((f) => f.endsWith(".md")).sort();
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? DEFAULT_DIR);
  const files = await mdFiles(dir);
  if (files.length === 0) throw new Error(`No lesson files (*.md) under ${dir}`);
  // Parse everything first: one invalid file stops the import before anything is written.
  const lessen = await Promise.all(files.map(async (f) => parseLes(f, await fs.readFile(path.join(dir, f), "utf8"))));
  const dubbel = lessen.find((l, i) => lessen.findIndex((m) => m.id === l.id) !== i);
  if (dubbel) throw new Error(`Two files have the id ${dubbel.id}`);
  const grammatica = await Promise.all((await mdFiles(GRAMMATICA_DIR)).map(async (f) => parseGrammatica(f, await fs.readFile(path.join(GRAMMATICA_DIR, f), "utf8"))));

  if (dry) {
    for (const g of grammatica) console.log(`${g.id}  grammatica (dry run)`);
    for (const les of lessen) console.log(`${les.id}  ${les.slug}  ${les.dialoog.length} regels, ${les.oefeningen.length} oefeningen (dry run)`);
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No database (DATABASE_URL).");
  const opened = openContentDatabase(url, {
    widgets: widgetRegistry,
    contentTypes: ContentTypeRegistry.of(coreContentTypeDefinitions, taalContentTypes),
  });
  try {
    for (const g of grammatica) console.log(`${g.id}  grammatica: ${await importGrammatica(opened.store, g, "import-lessen")}`);
    for (const les of lessen) console.log(`${les.id}  ${les.slug}: ${await importLes(opened.store, les, "import-lessen")}`);
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
