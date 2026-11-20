import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { FileContentStore } from "../src/file-store";
import {
  hreflangAlternates,
  itemLang,
  languageLinks,
  legacyFallback,
  localeHref,
  localizedSite,
  pageSlugsByLocale,
  pageTranslations,
  pickByLang,
  relabelLanguage,
  splitLocalePath,
  translationsFromSlugs,
} from "../src/lang";
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
    assert.equal(itemLang("menu", "pl"), "pl", "a menu exists per language");
    assert.equal(itemLang("theme", "pl"), "en");
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
    assert.equal((await store.listItems("menu"))[0].lang, "pl", "a menu is in the base language too");
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

describe("more languages side by side", () => {
  const site = { locales: ["nl", "en"], defaultLocale: "nl" };

  it("reads an address: the base language has no prefix, another language is the first segment", () => {
    assert.deepEqual(splitLocalePath(["en", "over", "ons"], site), { locale: "en", segments: ["over", "ons"] });
    assert.deepEqual(splitLocalePath(["over"], site), { locale: "nl", segments: ["over"] });
    assert.deepEqual(splitLocalePath(["nl", "over"], site), { locale: "nl", segments: ["nl", "over"] }, "the base language is no prefix");
    assert.deepEqual(splitLocalePath(["pl", "over"], site), { locale: "nl", segments: ["pl", "over"] }, "not a language of this site");
    assert.deepEqual(splitLocalePath([], site), { locale: "nl", segments: [] });
    assert.equal(localeHref("nl", "/over", "nl"), "/over");
    assert.equal(localeHref("en", "over/ons", "nl"), "/en/over/ons");
    assert.equal(localeHref("en", "/", "nl"), "/en");
    assert.equal(localeHref("nl", "", "nl"), "/");
  });

  it("en rows stand in for the base language only on a site without English", () => {
    assert.equal(legacyFallback(["nl"], "nl"), true);
    assert.equal(legacyFallback(["nl", "en"], "nl"), false);
    assert.equal(legacyFallback(undefined, "en"), false);
    const items = [
      { slug: "a", lang: "nl" },
      { slug: "a", lang: "en" },
      { slug: "only-en", lang: "en" },
    ];
    const slugs = (wanted: string, opts: { exact?: boolean; legacy?: boolean }) =>
      pickByLang(items, wanted, "nl", opts).map((i) => `${i.slug}:${i.lang}`).sort();
    assert.deepEqual(slugs("nl", { legacy: false }), ["a:nl"], "an English-only page is not Dutch");
    assert.deepEqual(slugs("en", { legacy: false }), ["a:en", "only-en:en"]);
    assert.deepEqual(slugs("en", { exact: true }), ["a:en", "only-en:en"]);
    assert.deepEqual(slugs("pl", { exact: true }), []);
  });

  it("a bilingual store: each side reads its own pages and its own menu", async () => {
    const store = new MemoryContentStore(createMemoryDb(), { defaultLocale: "nl", locales: ["nl", "en"] });
    await store.putItem("page", "over", page("over", "nl", "Over ons"));
    await store.putItem("page", "over", page("over", "en", "About us"));
    await store.putItem("page", "contact", page("contact", "nl", "Contact"));
    await store.putItem("menu", "main", { name: "main", items: [{ label: "Over", page: "over" }] });
    await store.putItem("menu", "main", { name: "main", items: [{ label: "About", page: "over" }] }, { lang: "en" });

    assert.equal((await store.getPage("over"))?.body, "Over ons");
    assert.equal((await store.getPage("over", { lang: "en", exactLang: true }))?.body, "About us");
    assert.equal(await store.getPage("contact", { lang: "en", exactLang: true }), null, "no translation: not there");
    assert.equal((await store.getPage("contact", { lang: "en" }))?.body, "Contact", "without exactLang: the base language");
    assert.deepEqual((await store.listPages({ lang: "en", exactLang: true })).map((p) => p.slug), ["over"]);
    assert.equal((await store.getMenu("main"))?.items[0].label, "Over");
    assert.equal((await store.getMenu("main", { lang: "en" }))?.items[0].label, "About");

    const translations = await pageTranslations(store, "over", site);
    assert.deepEqual(translations, [
      { locale: "nl", href: "/over" },
      { locale: "en", href: "/en/over" },
    ]);
    assert.deepEqual(hreflangAlternates(translations, "en", site, "https://x.test/"), {
      canonical: "https://x.test/en/over",
      languages: { nl: "https://x.test/over", en: "https://x.test/en/over", "x-default": "https://x.test/over" },
    });
    const slugs = await pageSlugsByLocale(store, site);
    assert.deepEqual({ nl: [...slugs.nl].sort(), en: slugs.en }, { nl: ["contact", "over"], en: ["over"] });
    assert.deepEqual(translationsFromSlugs(slugs, "over", site), translations, "the same answer without the store");
    assert.deepEqual(translationsFromSlugs(slugs, "blog/een-bericht", site), [], "no page of the store: no translation");
    const single = await pageTranslations(store, "contact", site);
    assert.deepEqual(hreflangAlternates(single, "nl", site), { canonical: "/contact", languages: {} });
    assert.deepEqual(languageLinks(single, site), [
      { locale: "nl", href: "/contact", translated: true },
      { locale: "en", href: "/en", translated: false },
    ]);
  });

  it("an item keeps the language it has when the caller names none (before relabel-lang)", async () => {
    const db = createMemoryDb();
    await new MemoryContentStore(db).putItem("menu", "main", { name: "main", items: [] });
    const store = new MemoryContentStore(db, { defaultLocale: "nl", locales: ["nl"] });
    assert.equal((await store.getItem("menu", "main"))?.lang, "en", "found under its old label");
    await store.putItem("menu", "main", { name: "main", items: [{ label: "Home", url: "/" }] });
    assert.equal((await store.listItems("menu")).length, 1, "still one menu");
    assert.equal((await store.getMenu("main"))?.items.length, 1);
    await store.putItem("menu", "footer", { name: "footer", items: [] });
    assert.equal((await store.getItem("menu", "footer"))?.lang, "nl", "a new one is in the base language");
  });

  it("the site's name and tagline per language, where given", () => {
    const cfg = { name: "Paratmos", tagline: "Samen modelleren", motto: "", translations: { en: { tagline: "Modelling together", motto: "" } } };
    assert.equal(localizedSite(cfg, "en").tagline, "Modelling together");
    assert.equal(localizedSite(cfg, "en").name, "Paratmos");
    assert.equal(localizedSite(cfg, "nl").tagline, "Samen modelleren");
  });
});
