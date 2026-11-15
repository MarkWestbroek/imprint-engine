import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { FileContentStore } from "@imprint/content-core";
import { PageRenderer, type WidgetContext } from "@imprint/runtime-admin";
import { widgetComponents } from "../src/widgets/components";
import { widgetRegistry } from "../src/widgets/registry";

/** The starting content in content/ is valid and renders through the shared renderer. */

const CONTENT = path.resolve(import.meta.dirname, "../content");
const store = new FileContentStore(CONTENT, { widgets: widgetRegistry });

async function renderHtml(element: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(element);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

describe("markwestbroek.nl: the starting content", () => {
  it("has a page behind every menu item", async () => {
    const menu = await store.getMenu("main");
    assert.ok(menu && menu.items.length >= 2, "the main menu");
    for (const item of menu.items) assert.ok(await store.getPage(item.page!), `page ${item.page}`);
  });

  it("renders the patchbay: every module, linked where it has a URL, with a cable each", async () => {
    const page = await store.getPage("home");
    assert.ok(page?.layout);
    const ctx: WidgetContext = { store, writableStore: null, readOptions: {} };
    const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />);
    for (const title of ["Architectuur", "MusicBrain", "Muziek", "Fotografie", "Therapie", "Taal", "Omnium", "Imprint"]) assert.ok(html.includes(title), title);
    assert.match(html, /<a class="pb-mod[^"]*" href="https:\/\/paratmos\.nl"/);
    // No URL yet: a module, not a link.
    assert.match(html, /<div class="pb-mod pb-geel"/);
    assert.equal(html.match(/class="pb-cable /g)?.length, 8);
  });
});
