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

describe("Omnium site: the starting content", () => {
  it("has a home page and a page behind every menu item", async () => {
    const menu = await store.getMenu("main");
    assert.ok(menu && menu.items.length >= 7, "the main menu");
    for (const slug of ["home", ...menu.items.map((i) => i.page!)]) {
      assert.ok(await store.getPage(slug), `page ${slug}`);
    }
  });

  it("renders the home page with the four pillars and the Studio screenshot", async () => {
    const page = await store.getPage("home");
    assert.ok(page?.layout);
    const ctx: WidgetContext = { store, writableStore: null, readOptions: {} };
    const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />);
    for (const pillar of ["Canoniek model", "Modelgedreven (MDA)", "Bitemporeel", "Samenwerken"]) assert.ok(html.includes(pillar), pillar);
    assert.match(html, /\/shots\/uml-overzicht\.png/);
  });

  it("shows the exchange formats as a table on Samenwerken", async () => {
    const page = await store.getPage("samenwerken");
    assert.ok(page?.layout);
    const ctx: WidgetContext = { store, writableStore: null, readOptions: {} };
    const html = await renderHtml(<PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />);
    assert.match(html, /<table/);
    assert.match(html, /Sparx Enterprise Architect/);
  });
});
