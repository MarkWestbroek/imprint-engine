import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { FileContentStore } from "@imprint/content-core";
import { PageRenderer, type WidgetContext } from "@imprint/runtime-admin";
import { widgetComponents } from "../src/widgets/components";
import { widgetRegistry } from "../src/widgets/registry";

/**
 * Exit criterion of Fase 2 (architecture.md §7): this site renders a page from
 * its content store with the same engine renderer as MusicBrain, through its
 * own, smaller widget selection.
 */

const CONTENT = path.resolve(import.meta.dirname, "../content");

async function renderHtml(element: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(element);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

describe("Imprint site: pages through the shared renderer", () => {
  it("picks its own nine standard widgets and knows none of MusicBrain's domain widgets", () => {
    assert.deepEqual(widgetRegistry.names(), ["hero", "text", "specs", "table", "accordion", "callout", "image", "album", "divider"]);
    assert.deepEqual(Object.keys(widgetComponents).sort(), [...widgetRegistry.names()].sort());
    assert.throws(() => widgetRegistry.parse({ type: "planning", config: {} }), /Unknown widget type "planning"/);
  });

  it("renders the example page from content/ with the engine renderer", async () => {
    const store = new FileContentStore(CONTENT, { widgets: widgetRegistry });
    const page = await store.getPage("techniek");
    assert.ok(page?.layout, "the example page is a composed page");
    const ctx: WidgetContext = { store, writableStore: null, readOptions: {} };

    const html = await renderHtml(
      <PageRenderer page={{ ...page, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />
    );
    assert.match(html, /<h1[^>]*>Zo rendert Imprint deze pagina<\/h1>/, "page title");
    assert.match(html, /Deze pagina komt uit de <em[^>]*>database<\/em>/, "hero with accent word");
    assert.match(html, /<table/, "table widget");
    assert.match(html, /<details/, "accordion widget");
    assert.match(html, /href="https:\/\/github.com\/MarkWestbroek\/imprint-engine"/, "callout button");
    assert.match(html, /--cols:2fr 1fr/, "a 2|1 row keeps its column spans");
  });
});
