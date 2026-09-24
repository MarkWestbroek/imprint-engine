import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { z } from "zod";

import { WidgetTypeRegistry } from "@imprint/content-core";
import { createImprint, defineImprint, resolveImprint, type ImprintConfig } from "../src/index";

/**
 * The composition-root contract (architecture.md §0): a config becomes an
 * instance whose backend follows the database URL, with the file store as
 * the no-database fallback. Database-backed cases run only when the test
 * databases are configured (see `npm run test:db`).
 */
const dirs: string[] = [];
after(async () => {
  for (const d of dirs) await fs.rm(d, { recursive: true, force: true });
});

async function contentDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imprint-config-"));
  dirs.push(dir);
  await fs.writeFile(
    path.join(dir, "site.json"),
    JSON.stringify({ name: "Cfg", tagline: "t", baseUrl: "https://cfg.test" })
  );
  return dir;
}

const registry = () =>
  new WidgetTypeRegistry().register({ name: "text", configSchema: z.object({ markdown: z.string() }) });

describe("defineImprint", () => {
  it("validates id, contentDir, database scheme and widgets", async () => {
    const base: ImprintConfig = { id: "ok-1", store: { contentDir: await contentDir() }, widgets: registry() };
    assert.equal(defineImprint(base), base, "returns the config itself");
    assert.throws(() => defineImprint({ ...base, id: "Not Ok" }), /must be lowercase/);
    assert.throws(() => defineImprint({ ...base, store: { contentDir: "" } }), /contentDir is required/);
    assert.throws(
      () => defineImprint({ ...base, store: { ...base.store, databaseUrl: "sqlite://x" } }),
      /unsupported scheme/
    );
    assert.throws(() => defineImprint({ ...base, session: { hours: 0 } }), /session.hours/);
    assert.throws(
      () => defineImprint({ ...base, widgets: [] as unknown as WidgetTypeRegistry }),
      /WidgetTypeRegistry/
    );
  });
});

describe("resolveImprint", () => {
  it("without a database URL: file store, no write side, no users, defaults", async () => {
    const dir = await contentDir();
    const imprint = resolveImprint({ id: "filesite", store: { contentDir: dir }, widgets: registry() });
    assert.equal(imprint.dialect, "file");
    assert.equal((await imprint.store.getSiteConfig()).name, "Cfg");
    assert.equal(imprint.writableStore, null);
    assert.equal(imprint.users, null);
    assert.deepEqual(imprint.session, { cookie: "imprint_filesite_session", hours: 12 });
    assert.ok(imprint.widgets.has("text"));
    await imprint.close();
  });

  it("treats an empty database URL as no database (CI builds without one)", async () => {
    const imprint = resolveImprint({
      id: "emptyurl",
      store: { contentDir: await contentDir(), databaseUrl: "" },
      widgets: registry(),
    });
    assert.equal(imprint.dialect, "file");
  });

  it("honours explicit session and asset settings", async () => {
    const imprint = resolveImprint({
      id: "custom",
      store: { contentDir: await contentDir() },
      widgets: registry(),
      session: { cookie: "imprint_session", hours: 2 },
      assets: { root: await contentDir(), baseUrl: "/files" },
    });
    assert.deepEqual(imprint.session, { cookie: "imprint_session", hours: 2 });
    const url = await imprint.assets.put("a/b.txt", new TextEncoder().encode("x"));
    assert.ok(url.startsWith("/files/a/"), `served under baseUrl: ${url}`);
  });

  it("hands secrets through; empty strings (an unset .env line) count as absent", async () => {
    const imprint = resolveImprint({
      id: "secrets",
      store: { contentDir: await contentDir() },
      widgets: registry(),
      secrets: { session: "s3cret", ingestToken: "", publish: { url: "https://example.test", token: "" } },
    });
    assert.deepEqual(imprint.secrets, {
      session: "s3cret",
      ingestToken: undefined,
      githubWebhook: undefined,
      publish: { url: "https://example.test", token: undefined },
    });
  });

  for (const [envVar, dialect] of [
    ["TEST_DATABASE_URL", "mysql"],
    ["TEST_PG_DATABASE_URL", "postgres"],
  ] as const) {
    const url = process.env[envVar];
    it(`with a ${dialect} URL: writable store and users`, { skip: url ? false : `${envVar} not set` }, async () => {
      const imprint = resolveImprint({
        id: `db-${dialect}`,
        store: { contentDir: await contentDir(), databaseUrl: url },
        widgets: registry(),
      });
      assert.equal(imprint.dialect, dialect);
      assert.ok(imprint.writableStore, "write side present");
      assert.equal(imprint.writableStore, imprint.readStore, "read and write side are one store");
      assert.notEqual(imprint.store, imprint.readStore, "the visitor's store is the guarded view of it");
      assert.equal(typeof imprint.storeFor({ type: "visitor", id: "x" }).getPage, "function");
      assert.ok(imprint.users, "users live next to the content");
      await imprint.close();
    });
  }
});

describe("createImprint", () => {
  it("is one instance per id for the life of the process", async () => {
    const cfg: ImprintConfig = { id: "cached", store: { contentDir: await contentDir() }, widgets: registry() };
    const a = createImprint(cfg);
    const b = createImprint({ ...cfg, session: { hours: 99 } });
    assert.equal(a, b, "second config with the same id is ignored: the instance already exists");
    assert.notEqual(createImprint({ ...cfg, id: "other" }), a);
  });
});

describe("plugins in the config", () => {
  const plugin = (name: string, types: string[] = []) => ({
    name,
    version: "0.1.0",
    contentTypes: types.map((t) => ({ name: t, schema: z.object({ slug: z.string() }), label: t, flags: ["listable" as const] })),
  });

  it("registers a plugin's content types next to the core's, and exposes the plugins", async () => {
    const imprint = resolveImprint({
      id: "plugged",
      store: { contentDir: await contentDir() },
      widgets: registry(),
      plugins: [plugin("recipes", ["recipe"])],
    });
    assert.ok(imprint.contentTypes.has("recipe", "listable"));
    assert.ok(imprint.contentTypes.has("page"));
    assert.deepEqual(imprint.plugins.map((p) => p.name), ["recipes"]);
  });

  it("refuses a bad name, a missing version, a plugin configured twice, and a type that already exists", async () => {
    const base = { id: "plugged-2", store: { contentDir: await contentDir() }, widgets: registry() };
    assert.throws(() => defineImprint({ ...base, plugins: [{ ...plugin("Bad Name") }] }), /must be lowercase/);
    assert.throws(() => defineImprint({ ...base, plugins: [{ name: "x", version: "" }] }), /needs a version/);
    assert.throws(() => defineImprint({ ...base, plugins: [plugin("a"), plugin("a")] }), /configured twice/);
    assert.throws(() => defineImprint({ ...base, plugins: [plugin("pages-again", ["page"])] }), /plugin "pages-again" defines content type "page", which already exists/);
    assert.throws(() => defineImprint({ ...base, plugins: [plugin("a", ["thing"]), plugin("b", ["thing"])] }), /plugin "b" defines content type "thing"/);
  });
});
