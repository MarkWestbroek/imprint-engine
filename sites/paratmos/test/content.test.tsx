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
const store = new FileContentStore(CONTENT, { widgets: widgetRegistry });
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
  it("has a page behind every menu item that points to one", async () => {
    const menu = await store.getMenu("main");
    assert.ok(menu && menu.items.length >= 5, "the main menu");
    const all = (list: MenuItem[]): MenuItem[] => list.flatMap((i) => [i, ...all(i.children ?? [])]);
    for (const item of all(menu.items)) if (item.page) assert.ok(await store.getPage(item.page), `page ${item.page}`);
  });

  it("renders every page", async () => {
    const pages = await store.listPages();
    assert.ok(pages.length >= 9);
    for (const page of pages) {
      assert.ok(page.layout, page.slug);
      const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />);
      assert.ok(html.length > 200, page.slug);
    }
  });

  it("draws the home page: the opening, the triangle, and the model with a line to each derived artefact", async () => {
    const page = await store.getPage("home");
    assert.ok(page?.layout);
    const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />);
    assert.match(html, /<h1 class="db-kop">IT voorbij aan het verkopen van lucht\.<\/h1>/);
    assert.match(html, /<h2 class="afl-kop">Eén model\. De rest volgt eruit\.<\/h2>/);
    // The triangle, with the five surroundings round its ring.
    assert.equal(html.match(/class="de-omgeving"/g)?.length, 5);
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
    const known = new Set<string>(["/", "/blog", "/kennisbank", "/search"]);
    for (const p of await store.listPages()) known.add(`/${p.slug}`);
    for (const p of wikiPages) known.add(wikiPageHref(p, folders));
    for (const t of await items<{ slug: string }>("term")) known.add(`/terms/${t.slug}`);
    for (const p of await items<{ slug: string }>("post")) known.add(`/blog/${p.slug}`);

    const sources: [string, string][] = [];
    for (const p of await store.listPages()) sources.push([`page ${p.slug}`, JSON.stringify(p.layout)]);
    for (const type of ["wiki-page", "term", "post"]) for (const d of await items<{ slug: string }>(type)) sources.push([`${type} ${d.slug}`, JSON.stringify(d)]);
    sources.push(["menu", JSON.stringify(await store.getMenu("main"))]);
    for (const [where, text] of sources) {
      // Markdown links `](/…)` and widget fields ("href", "buttonUrl", "url") that start with a slash.
      for (const m of text.matchAll(/(?:\]\(|"(?:href|buttonUrl|url)":")(\/[^)"#\s]*)/g)) assert.ok(known.has(m[1]!), `${where} links to ${m[1]}`);
    }
  });
});
