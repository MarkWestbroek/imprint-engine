import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import matter from "gray-matter";

import { FileContentStore } from "../src/file-store";
import type { WidgetTypeRegistry } from "../src/widgets";
import { MENUS, PAGES, PRODUCTS, RELEASES, SITE, THEMES } from "./fixtures";
import { contentStoreContract } from "./store-contract";

/**
 * Characterisation of the file-backed store (v0). The shared fixtures are
 * written to a temp content dir in the layout file-store.ts documents:
 * markdown pages with frontmatter, JSON for composed pages and everything
 * else, `<slug>.<lang>.json` for translations.
 */

const dirs: string[] = [];
after(async () => {
  for (const dir of dirs) await fs.rm(dir, { recursive: true, force: true });
});

async function writeFixtures(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imprint-file-store-"));
  dirs.push(dir);
  const write = async (rel: string, body: string) => {
    const file = path.join(dir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body, "utf8");
  };
  const json = (v: unknown) => JSON.stringify(v, null, 2);

  await write("site.json", json(SITE));
  for (const page of PAGES) {
    const { body, ...meta } = page;
    const suffix = "lang" in page && page.lang !== "en" ? `.${page.lang}` : "";
    if ("layout" in page) {
      await write(`pages/${page.slug}${suffix}.json`, json({ ...meta, body }));
    } else {
      await write(`pages/${page.slug}${suffix}.md`, matter.stringify(body, meta));
    }
  }
  for (const p of PRODUCTS) {
    const suffix = p.lang !== "en" ? `.${p.lang}` : "";
    await write(`products/${p.slug}${suffix}.json`, json(p));
  }
  for (const r of RELEASES) await write(`releases/${r.project}-${r.version}.json`, json(r));
  for (const m of MENUS) await write(`menus/${m.name}.json`, json(m));
  for (const t of THEMES) await write(`themes/${t.name}.json`, json(t));
  return dir;
}

let contentDir: Promise<string> | undefined;
const factory = async (opts?: { widgets?: WidgetTypeRegistry }) =>
  new FileContentStore(await (contentDir ??= writeFixtures()), opts);

contentStoreContract("FileContentStore", factory);

describe("FileContentStore specifics", () => {
  it("treats asOf purely as valid time: a past asOf hides pages published after it", async () => {
    // No transaction time in files — there is no "what did we assert back
    // then"; the DB store differs here (see db-store.test.ts).
    const store = await factory();
    const slugs = (await store.listPages({ asOf: new Date("2026-01-07") })).map((p) => p.slug);
    assert.deepEqual(slugs, ["legacy", "composed", "posts/older", "nodate"]);
  });

  it("returns empty lists for content folders that do not exist", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imprint-empty-"));
    dirs.push(dir);
    const store = new FileContentStore(dir);
    assert.deepEqual(await store.listPages(), []);
    assert.deepEqual(await store.listProducts(), []);
    assert.deepEqual(await store.listReleases(), []);
    assert.deepEqual(await store.listThemes(), []);
    assert.equal(await store.getMenu("main"), null);
    await assert.rejects(() => store.getSiteConfig(), /ENOENT/);
  });

  it("fails the read (and thus the build) on a file that violates its schema", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imprint-broken-"));
    dirs.push(dir);
    await fs.mkdir(path.join(dir, "products"));
    await fs.writeFile(
      path.join(dir, "products", "bad.json"),
      JSON.stringify({ slug: "bad", name: "Bad", tagline: "x", status: "nonsense" })
    );
    await assert.rejects(() => new FileContentStore(dir).listProducts());
  });
});
