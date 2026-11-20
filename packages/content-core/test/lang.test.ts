import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { FileContentStore } from "../src/file-store";
import { itemLang, pickByLang, relabelLanguage } from "../src/lang";
import { createMemoryDb, MemoryContentStore } from "../src/memory-store";
import { Locale } from "../src/schemas";

/**
 * The base language of a site (W5/S9, design/meertaligheid.md layer 1): what a
 * read or write without a language means, and how a site whose content is
 * still labelled "en" moves to it.
 */
const page = (slug: string, lang: string, body: string) => ({ slug, lang, title: slug, description: "", body });

describe("languages", () => {
  it("a language is any two-letter code, not a fixed list", () => {
    assert.equal(Locale.parse("pl"), "pl");
    assert.throws(() => Locale.parse("pl-PL"));
    assert.throws(() => Locale.parse("Polski"));
  });

  it("picks per slug: wanted, else the base language, else en", () => {
    const items = [
      { slug: "a", lang: "en", v: "a-en" },
      { slug: "a", lang: "nl", v: "a-nl" },
      { slug: "a", lang: "pl", v: "a-pl" },
      { slug: "b", lang: "nl", v: "b-nl" },
      { slug: "c", lang: "en", v: "c-en" },
    ];
    const pick = (wanted?: string, base?: string) => pickByLang(items, wanted, base).map((i) => i.v).sort();
    assert.deepEqual(pick(undefined, "nl"), ["a-nl", "b-nl", "c-en"], "base language first, old en rows still found");
    assert.deepEqual(pick("pl", "nl"), ["a-pl", "b-nl", "c-en"]);
    assert.deepEqual(pick(), ["a-en", "c-en"], "without a base language: as before");
    assert.deepEqual(pick("nl"), ["a-nl", "b-nl", "c-en"]);
  });

  it("only the types read by language follow the base language", () => {
    assert.equal(itemLang("page", "pl"), "pl");
    assert.equal(itemLang("menu", "pl"), "en");
    assert.equal(itemLang("asset", "pl"), "en");
    assert.equal(itemLang("page"), "en");
  });
});

describe("a store with a base language", () => {
  it("writes and reads pages in it when no language is given", async () => {
    const store = new MemoryContentStore(createMemoryDb(), { defaultLocale: "pl" });
    await store.putItem("page", "o-nas", page("o-nas", "pl", "O nas"));
    assert.equal((await store.listItems("page"))[0].lang, "pl");
    assert.equal((await store.getItem("page", "o-nas"))?.lang, "pl");
    assert.equal((await store.getPage("o-nas"))?.body, "O nas");
    assert.equal((await store.listVersions("page", "o-nas")).length, 1);

    await store.putItem("menu", "main", { name: "main", items: [] });
    assert.equal((await store.listItems("menu"))[0].lang, "en", "a menu has no language of its own");
  });

  it("still shows rows labelled en, and prefers the base language over them", async () => {
    const db = createMemoryDb();
    const before = new MemoryContentStore(db);
    await before.putItem("page", "over", page("over", "en", "oud"));
    await before.putItem("page", "contact", page("contact", "en", "contact"));

    const store = new MemoryContentStore(db, { defaultLocale: "nl" });
    assert.equal((await store.getPage("over"))?.body, "oud");
    await store.putItem("page", "over", page("over", "nl", "nieuw"));
    assert.equal((await store.getPage("over"))?.body, "nieuw");
    assert.equal((await store.listPages()).length, 2, "one page per slug");
  });

  it("relabels en to the base language with history, and only once", async () => {
    const db = createMemoryDb();
    const validFrom = new Date("2024-05-01T00:00:00Z");
    const before = new MemoryContentStore(db);
    await before.putItem("page", "over", page("over", "en", "Over ons"), { validFrom });
    await before.putItem("page", "contact", page("contact", "en", "Contact"));
    await before.putItem("page", "contact", page("contact", "nl", "Contact (al nl)"), { lang: "nl" });

    const store = new MemoryContentStore(db, { defaultLocale: "nl" });
    const dry = await relabelLanguage(store, "page", "nl", { dryRun: true });
    assert.deepEqual(dry, { relabelled: ["over"], skipped: ["contact"] });
    assert.equal((await store.getItem("page", "over", "en"))?.lang, "en", "a dry run changes nothing");

    assert.deepEqual(await relabelLanguage(store, "page", "nl", { by: "test" }), dry);
    const moved = await store.getItem("page", "over");
    assert.equal(moved?.lang, "nl");
    assert.equal((moved?.data as { lang: string }).lang, "nl", "the label inside the data follows");
    assert.equal(moved?.validFrom.toISOString(), validFrom.toISOString(), "validity is kept");
    assert.equal(await store.getItem("page", "over", "en"), null, "the en version has ended");
    assert.equal((await store.listVersions("page", "over", "en")).length, 1, "and is still in the history");
    assert.equal((await store.getItem("page", "contact", "en"))?.lang, "en", "an item with both is left alone");

    assert.deepEqual(await relabelLanguage(store, "page", "nl"), { relabelled: [], skipped: ["contact"] });
  });
});

describe("the file store with a base language", () => {
  const dirs: string[] = [];
  after(async () => {
    for (const d of dirs) await fs.rm(d, { recursive: true, force: true });
  });

  it("reads a file without lang as the base language", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imprint-lang-"));
    dirs.push(dir);
    await fs.mkdir(path.join(dir, "pages"));
    await fs.writeFile(path.join(dir, "pages", "over.md"), "---\nslug: over\ntitle: Over\n---\nOver ons");
    await fs.writeFile(path.join(dir, "pages", "about.md"), "---\nslug: about\nlang: en\ntitle: About\n---\nAbout us");

    const nl = new FileContentStore(dir, { defaultLocale: "nl" });
    assert.equal((await nl.getPage("over"))?.lang, "nl");
    assert.equal((await nl.getPage("about"))?.lang, "en", "a named language stays");
    assert.equal((await new FileContentStore(dir).getPage("over"))?.lang, "en", "no base language: en, as before");
  });
});
