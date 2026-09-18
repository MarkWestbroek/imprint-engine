import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WritableContentStore } from "../src/store";
import type { WidgetTypeRegistry } from "../src/widgets";
import { emptyRegistry } from "./fixtures";

/**
 * WritableContentStore contract — the bitemporal-light write semantics every
 * database backend must share (architecture.md §4). Runs after the read
 * contract, against the same seeded database; the tests clean up what they
 * add so the fixtures stay as the read contract expects them.
 */
export type WritableFactory = (opts?: { widgets?: WidgetTypeRegistry }) => Promise<WritableContentStore>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function writableStoreContract(name: string, factory: WritableFactory): void {
  describe(`${name}: WritableContentStore contract`, () => {
    it("putItem asserts a new version and supersedes the old one; history is newest first", async () => {
      const store = await factory();
      await store.putItem("page", "versioned", { slug: "versioned", title: "v1", body: "one" });
      await sleep(5);
      await store.putItem("page", "versioned", { slug: "versioned", title: "v2", body: "two" }, { by: "tester" });

      const current = await store.getItem("page", "versioned");
      assert.equal((current?.data as { title: string }).title, "v2");
      assert.equal(current?.txTo, null);
      assert.equal(current?.createdBy, "tester");
      assert.ok(current?.txFrom instanceof Date);
      assert.ok(current?.validFrom instanceof Date);

      const versions = await store.listVersions("page", "versioned");
      assert.equal(versions.length, 2);
      assert.equal((versions[0].data as { title: string }).title, "v2");
      assert.equal((versions[1].data as { title: string }).title, "v1");
      assert.ok(versions[1].txTo instanceof Date, "old version is closed, not deleted");
      assert.ok(versions[1].txTo! <= versions[0].txFrom);
    });

    it("time-travels: asOf between two versions returns the older one", async () => {
      const store = await factory();
      await store.putItem("page", "travel", { slug: "travel", title: "before", body: "" });
      await sleep(10);
      const between = new Date();
      await sleep(10);
      await store.putItem("page", "travel", { slug: "travel", title: "after", body: "" });

      assert.equal((await store.getPage("travel"))?.title, "after");
      assert.equal((await store.getPage("travel", { asOf: between }))?.title, "before");
    });

    it("site config time-travels too; before the first assertion it is the current one", async () => {
      const store = await factory();
      const original = await store.getSiteConfig();
      await sleep(10);
      const between = new Date();
      await sleep(10);
      await store.putItem("site", "site", { ...original, name: "Renamed" });

      assert.equal((await store.getSiteConfig()).name, "Renamed");
      assert.equal((await store.getSiteConfig({ asOf: between })).name, original.name);
      assert.equal((await store.getSiteConfig({ asOf: new Date("2019-06-01") })).name, "Renamed");
      await store.putItem("site", "site", original);
    });

    it("a past asOf before the first assertion sees nothing (transaction time, unlike the file store)", async () => {
      const store = await factory();
      assert.equal(await store.getPage("about", { asOf: new Date("2026-01-07") }), null);
      assert.deepEqual(await store.listPages({ asOf: new Date("2019-06-01") }), []);
    });

    it("deleteItem tombstones the current assertion; history survives", async () => {
      const store = await factory();
      await store.putItem("page", "doomed", { slug: "doomed", title: "Doomed", body: "" });
      await store.deleteItem("page", "doomed");

      assert.equal(await store.getItem("page", "doomed"), null);
      assert.equal(await store.getPage("doomed"), null);
      const versions = await store.listVersions("page", "doomed");
      assert.equal(versions.length, 1);
      assert.ok(versions[0].txTo instanceof Date);
    });

    it("listItems ignores valid time (admin sees scheduled content); reads respect it", async () => {
      const store = await factory();
      await store.putItem(
        "page",
        "scheduled",
        { slug: "scheduled", title: "Scheduled", body: "" },
        { validFrom: new Date("2099-06-01T00:00:00Z") }
      );
      const items = await store.listItems("page");
      assert.ok(items.some((i) => i.slug === "scheduled"));
      assert.equal(await store.getPage("scheduled"), null);
      assert.equal((await store.getPage("scheduled", { asOf: new Date("2100-01-01") }))?.title, "Scheduled");
    });

    it("listItems is ordered by slug, then lang", async () => {
      const store = await factory();
      const keys = (await store.listItems("product")).map((i) => `${i.slug}:${i.lang}`);
      assert.deepEqual(keys, ["alpha:en", "alpha:nl", "beta:en"]);
    });

    it("rejects data that fails the type's zod schema", async () => {
      const store = await factory();
      await assert.rejects(() => store.putItem("page", "bad", { slug: "bad" }));
      await assert.rejects(() => store.putItem("product", "bad", { slug: "bad", name: "x", tagline: "y", status: "nope" }));
      assert.equal(await store.getItem("page", "bad"), null, "nothing written");
    });

    it("refuses an enforced reference to content that does not exist", async () => {
      const store = await factory();
      await store.putItem("relations", "relations", {
        rules: [{ fromType: "release", field: "product", toType: "product", enforce: true }],
      });
      await assert.rejects(
        () => store.putItem("release", "ghost", { project: "fw", version: "9.0.0", date: "2026-01-01", product: "ghost" }),
        /References not found: product → product\/ghost/
      );
      await store.putItem("release", "fw-2.0.0", { project: "fw", version: "2.0.0", date: "2026-04-01", product: "alpha" });
      assert.ok((await store.listReleases({ product: "alpha" })).some((r) => r.version === "2.0.0"));
      // Leave the fixtures as the read contract expects them.
      await store.deleteItem("release", "fw-2.0.0");
      await store.deleteItem("relations", "relations");
    });

    it("refuses to store a page whose layout uses a widget the registry does not know", async () => {
      const store = await factory({ widgets: emptyRegistry() });
      await assert.rejects(
        () =>
          store.putItem("page", "badwidget", {
            slug: "badwidget",
            title: "x",
            layout: { rows: [{ cells: [{ span: 1, widgets: [{ type: "text", config: {} }] }] }] },
          }),
        /Unknown widget type "text"/
      );
    });
  });
}
