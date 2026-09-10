import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ContentStore } from "../src/store";
import type { WidgetTypeRegistry } from "../src/widgets";
import { emptyRegistry, textOnlyRegistry } from "./fixtures";

/**
 * ContentStore contract — the read behaviour every backend must share
 * (architecture.md §0: "backend alleen via ContentStore"). These are
 * characterisation tests: they pin down what the stores do *today*, so a
 * later extraction or a new backend (Postgres, bitemporal register) can prove
 * it changed nothing.
 *
 * A backend plugs in with a factory that materialises the shared fixtures and
 * returns a store, optionally with a widget registry for layout validation.
 */
export type StoreFactory = (opts?: { widgets?: WidgetTypeRegistry }) => Promise<ContentStore>;

export function contentStoreContract(name: string, factory: StoreFactory): void {
  describe(`${name}: ContentStore contract`, () => {
    it("reads the site config", async () => {
      const store = await factory();
      const site = await store.getSiteConfig();
      assert.equal(site.name, "Fixture");
      assert.equal(site.defaultLocale, "en", "schema default applied");
      assert.deepEqual(site.links, {}, "schema default applied");
    });

    describe("pages", () => {
      it("hides drafts and future pages, newest first, undated last", async () => {
        const store = await factory();
        const slugs = (await store.listPages()).map((p) => p.slug);
        assert.deepEqual(slugs, [
          "posts/hello",
          "about",
          "legacy",
          "composed",
          "posts/older",
          "nodate",
        ]);
      });

      it("includes drafts only when asked (previews), never future pages", async () => {
        const store = await factory();
        const slugs = (await store.listPages({ includeDrafts: true })).map((p) => p.slug);
        assert.ok(slugs.includes("secret"));
        assert.ok(!slugs.includes("future"));
      });

      it("asOf in the future reveals scheduled pages", async () => {
        const store = await factory();
        const slugs = (await store.listPages({ asOf: new Date("2100-01-01") })).map(
          (p) => p.slug
        );
        assert.ok(slugs.includes("future"));
        assert.equal(slugs[0], "future", "still sorted by publishedAt desc");
      });

      it("filters by slug prefix", async () => {
        const store = await factory();
        const slugs = (await store.listPages({ prefix: "posts/" })).map((p) => p.slug);
        assert.deepEqual(slugs, ["posts/hello", "posts/older"]);
      });

      it("overlays the requested language on the EN base (S9)", async () => {
        const store = await factory();
        const nl = await store.listPages({ lang: "nl" });
        assert.equal(nl.find((p) => p.slug === "about")?.body, "Over NL");
        assert.equal(nl.find((p) => p.slug === "posts/hello")?.body, "first post", "fallback");
        assert.equal(nl.length, (await store.listPages()).length, "no duplicates per slug");
        const en = await store.getPage("about");
        assert.equal(en?.body, "About EN");
      });

      it("getPage returns null for unknown, draft and future slugs", async () => {
        const store = await factory();
        assert.equal(await store.getPage("nope"), null);
        assert.equal(await store.getPage("secret"), null);
        assert.equal(await store.getPage("future"), null);
        assert.equal((await store.getPage("about"))?.title, "About");
      });

      it("keeps a composed layout (rows) and a legacy layout (template + regions) intact", async () => {
        const store = await factory();
        const composed = await store.getPage("composed");
        assert.equal(composed?.layout?.rows?.[0].cells.length, 2);
        assert.equal(composed?.layout?.rows?.[0].cells[1].span, 2);
        const legacy = await store.getPage("legacy");
        assert.equal(legacy?.layout?.template, "sidebar-left");
        assert.equal(legacy?.layout?.widgets?.[0].region, "sidebar");
        assert.equal(legacy?.layout?.rows, undefined, "not converted by the store");
      });

      it("validates widget configs against the registry when one is given", async () => {
        const known = await factory({ widgets: textOnlyRegistry() });
        const page = await known.getPage("composed");
        assert.deepEqual(page?.layout?.rows?.[0].cells[0].widgets[0], {
          type: "text",
          config: { markdown: "hi" },
        });

        const unknown = await factory({ widgets: emptyRegistry() });
        await assert.rejects(() => unknown.listPages(), /Unknown widget type "text"/);
      });
    });

    describe("products", () => {
      it("sorts by order, then slug; language overlay per slug", async () => {
        const store = await factory();
        assert.deepEqual(
          (await store.listProducts()).map((p) => `${p.slug}:${p.name}`),
          ["beta:Beta", "alpha:Alpha"]
        );
        assert.deepEqual(
          (await store.listProducts({ lang: "nl" })).map((p) => `${p.slug}:${p.name}`),
          ["beta:Beta", "alpha:Alfa"]
        );
        assert.equal((await store.getProduct("alpha"))?.name, "Alpha");
        assert.equal(await store.getProduct("nope"), null);
      });
    });

    describe("releases", () => {
      it("hides releases dated after asOf (default: now), newest first", async () => {
        const store = await factory();
        const versions = (await store.listReleases()).map((r) => `${r.project}@${r.version}`);
        assert.deepEqual(versions, ["fw@1.1.0", "fw@1.0.0"]);
        const later = await store.listReleases({ asOf: new Date("2100-01-01") });
        assert.equal(later[0].project, "sim");
      });

      it("filters by project and by product", async () => {
        const store = await factory();
        assert.equal((await store.listReleases({ project: "sim" })).length, 0);
        assert.equal((await store.listReleases({ project: "fw" })).length, 2);
        assert.equal((await store.listReleases({ product: "alpha" })).length, 2);
        assert.equal((await store.listReleases({ product: "beta" })).length, 0);
      });

      it("applies schema defaults (channel, components, downloads)", async () => {
        const store = await factory();
        const r = (await store.listReleases({ project: "fw" })).find((x) => x.version === "1.0.0");
        assert.equal(r?.channel, "stable");
        assert.deepEqual(r?.components, []);
        assert.deepEqual(r?.downloads, []);
      });
    });

    describe("components and board-specs", () => {
      it("are empty lists (not errors) when the site has none", async () => {
        const store = await factory();
        assert.deepEqual(await store.listComponents(), []);
        assert.equal(await store.getComponent("nope"), null);
        assert.deepEqual(await store.listBoardSpecs(), []);
        assert.equal(await store.getBoardSpec("nope"), null);
      });
    });

    describe("menus and themes", () => {
      it("getMenu returns the named menu or null", async () => {
        const store = await factory();
        const menu = await store.getMenu("main");
        assert.equal(menu?.items.length, 2);
        assert.equal(menu?.items[1].children?.[0].page, "posts/hello");
        assert.equal(await store.getMenu("nope"), null);
      });

      it("listThemes sorts by order, then name", async () => {
        const store = await factory();
        assert.deepEqual(
          (await store.listThemes()).map((t) => t.name),
          ["mid", "zulu", "alpha"]
        );
        const t = (await store.listThemes())[0];
        assert.equal(t.colors.accent2, "", "schema default applied");
        assert.deepEqual(t.fonts, { sans: "", mono: "" });
      });
    });
  });
}
