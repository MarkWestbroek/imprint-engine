import { promises as fs } from "node:fs";
import path from "node:path";

import type { WritableContentStore } from "../src/store";
import { MENUS, PAGES, PRODUCTS, RELEASES, SITE, THEMES } from "./fixtures";

/**
 * Shared plumbing for the database backends under test. A test database is
 * named by an env var; its name must end in `_test` because the suites drop
 * and recreate the tables using the real drizzle migrations of the dialect.
 */
export function testDatabaseUrl(envVar: string): string | undefined {
  const url = process.env[envVar];
  if (!url) return undefined;
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`${envVar} must point at a *_test database (got "${dbName}")`);
  }
  return url;
}

/** The SQL statements of every migration in a drizzle journal dir, in order. */
export async function migrationStatements(journalDir: string): Promise<string[]> {
  const dir = path.resolve(import.meta.dirname, "../../..", journalDir);
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const out: string[] = [];
  for (const file of files) {
    const script = await fs.readFile(path.join(dir, file), "utf8");
    for (const statement of script.split("--> statement-breakpoint")) {
      if (statement.trim()) out.push(statement);
    }
  }
  return out;
}

/** Seed the shared fixtures through the write side (never raw SQL — CLAUDE.md). */
export async function seedFixtures(store: WritableContentStore): Promise<void> {
  const validFrom = new Date("2020-01-01T00:00:00Z");
  await store.putItem("site", "site", SITE, { validFrom });
  for (const page of PAGES) {
    await store.putItem("page", page.slug, page, {
      lang: "lang" in page ? page.lang : "en",
      validFrom,
    });
  }
  for (const p of PRODUCTS) await store.putItem("product", p.slug, p, { lang: p.lang, validFrom });
  for (const r of RELEASES) {
    await store.putItem("release", `${r.project}-${r.version}`, r, { validFrom });
  }
  for (const m of MENUS) await store.putItem("menu", m.name, m, { validFrom });
  for (const t of THEMES) await store.putItem("theme", t.name, t, { validFrom });
}
