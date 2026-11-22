import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { ContentTypeRegistry, coreContentTypeDefinitions, FileContentStore, type MenuItem } from "@imprint/content-core";
import { PageRenderer, type WidgetContext } from "@imprint/runtime-admin";
import { blogContentTypes } from "@imprint/plugin-blog/content-types";
import { glossaryContentTypes } from "@imprint/plugin-glossary/content-types";
import { wikiContentTypes } from "@imprint/plugin-wiki/content-types";
import { wikiPageHref } from "@imprint/plugin-wiki/href";
import type { WikiFolder, WikiPage } from "@imprint/plugin-wiki/schemas";
import { widgetComponents } from "../src/widgets/components";
import { widgetRegistry } from "../src/widgets/registry";

/** The starting content in content/ is valid, renders through the shared renderer, and its internal links lead somewhere. */

const CONTENT = path.resolve(import.meta.dirname, "../content");
// As imprint.config.ts: Dutch is the base language, English the second.
const LOCALES = ["nl", "en"];
const store = new FileContentStore(CONTENT, { widgets: widgetRegistry, defaultLocale: "nl", locales: LOCALES });
const inLang = (lang: string) => (lang === "nl" ? { lang } : { lang, exactLang: true });
const href = (lang: string, slug: string) => (lang === "nl" ? `/${slug === "home" ? "" : slug}` : `/${lang}${slug === "home" ? "" : `/${slug}`}`);
const contentTypes = ContentTypeRegistry.of(coreContentTypeDefinitions, wikiContentTypes, glossaryContentTypes, blogContentTypes);
const ctx: WidgetContext = { store, writableStore: null, readOptions: {} };

async function renderHtml(element: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(element);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

/** The plugin content of one type, parsed with the type's schema as put-content does. */
async function items<T>(type: string): Promise<T[]> {
  const dir = path.join(CONTENT, "items", type);
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  return Promise.all(files.map(async (f) => contentTypes.get(type).schema.parse(JSON.parse(await fs.readFile(path.join(dir, f), "utf8"))) as T));
}

describe("paratmos.nl: the starting content", () => {
  it("has, per language, a page in that language behind every menu item that points to one", async () => {
    const all = (list: MenuItem[]): MenuItem[] => list.flatMap((i) => [i, ...all(i.children ?? [])]);
    for (const lang of LOCALES) {
      const menu = await store.getMenu("main", inLang(lang));
      assert.ok(menu && menu.items.length >= 5, `the main menu (${lang})`);
      for (const item of all(menu.items)) if (item.page) assert.ok(await store.getPage(item.page, inLang(lang)), `page ${item.page} (${lang})`);
    }
  });

  it("has an English version of every page except the glossary, with the same slug", async () => {
    const nl = (await store.listPages(inLang("nl"))).map((p) => p.slug).sort();
    const en = (await store.listPages(inLang("en"))).map((p) => p.slug).sort();
    assert.deepEqual(en, nl.filter((s) => s !== "begrippen"));
    for (const p of await store.listPages(inLang("en"))) assert.equal(p.lang, "en", p.slug);
  });

  it("renders every page in both languages", async () => {
    for (const lang of LOCALES) {
      const pages = await store.listPages(inLang(lang));
      assert.ok(pages.length >= 8, lang);
      for (const page of pages) {
        assert.ok(page.layout, page.slug);
        const c: WidgetContext = { ...ctx, locale: lang, readOptions: inLang(lang), ...(lang === "nl" ? {} : { pathPrefix: `/${lang}` }) };
        const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={c} />);
        assert.ok(html.length > 200, `${page.slug} (${lang})`);
      }
    }
  });

  it("draws the home page: the opening, the triangle, and the model with a line to each derived artefact", async () => {
    const page = await store.getPage("home", inLang("nl"));
    assert.ok(page?.layout);
    const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />);
    assert.match(html, /<h1 class="db-kop">IT voorbij aan het verkopen van lucht\.<\/h1>/);
    assert.match(html, /<h2 class="afl-kop">Eén model\. De rest volgt eruit\.<\/h2>/);
    // The triangle, with the six surroundings round its ring.
    assert.equal(html.match(/class="de-omgeving"/g)?.length, 6);
    assert.equal(html.match(/class="afl-item"/g)?.length, 4);
  });

  it("has valid plugin content, with every folder in its wiki and every page in a folder", async () => {
    const wikis = await items<{ slug: string }>("wiki");
    const folders = await items<WikiFolder>("wiki-folder");
    const pages = await items<WikiPage>("wiki-page");
    assert.deepEqual(wikis.map((w) => w.slug), ["kennisbank"]);
    for (const f of folders) assert.equal(f.wiki, "kennisbank", f.slug);
    for (const p of pages) assert.ok(folders.some((f) => f.slug === p.folder), `${p.slug} → ${p.folder}`);
    assert.ok((await items("term")).length >= 10);
    assert.ok((await items("post")).length >= 1);
  });

  it("links only to addresses that exist", async () => {
    const folders = await items<WikiFolder>("wiki-folder");
    const wikiPages = await items<WikiPage>("wiki-page");
    const known = new Set<string>(["/", "/en", "/blog", "/kennisbank", "/search"]);
    for (const lang of LOCALES) for (const p of await store.listPages(inLang(lang))) known.add(href(lang, p.slug));
    for (const p of wikiPages) known.add(wikiPageHref(p, folders));
    for (const t of await items<{ slug: string }>("term")) known.add(`/terms/${t.slug}`);
    for (const p of await items<{ slug: string }>("post")) known.add(`/blog/${p.slug}`);

    const sources: [string, string][] = [];
    for (const lang of LOCALES) for (const p of await store.listPages(inLang(lang))) sources.push([`page ${p.slug} (${lang})`, JSON.stringify(p.layout)]);
    for (const type of ["wiki-page", "term", "post"]) for (const d of await items<{ slug: string }>(type)) sources.push([`${type} ${d.slug}`, JSON.stringify(d)]);
    for (const lang of LOCALES) sources.push([`menu (${lang})`, JSON.stringify(await store.getMenu("main", inLang(lang)))]);
    for (const [where, text] of sources) {
      // Markdown links `](/…)` and widget fields ("href", "buttonUrl", "url") that start with a slash.
      for (const m of text.matchAll(/(?:\]\(|"(?:href|buttonUrl|url)":")(\/[^)"#\s]*)/g)) assert.ok(known.has(m[1]!), `${where} links to ${m[1]}`);
    }
  });
});
