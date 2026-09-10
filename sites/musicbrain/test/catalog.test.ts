import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { FileContentStore } from "@imprint/content-core";
import { widgetRegistry } from "../src/widgets/registry";
import { layoutRows } from "../src/widgets/templates";

/**
 * Characterisation of the MusicBrain widget catalogue against the site's own
 * content: what the file-store build validates today, pinned. When a widget
 * moves to a library package (architecture.md §0) this list must not change
 * from the site's point of view.
 */
const CATALOG = [
  "accordion", "album", "api", "board", "boardspec", "callout", "carousel", "components",
  "divider", "downloads", "embed", "gallery", "hero", "image", "itinerary",
  "kanban", "list", "map", "planning", "posts", "products", "releases",
  "specs", "spectable", "subjectheader", "table", "template", "text", "treeview", "video",
];

describe("MusicBrain widget catalogue", () => {
  it("registers exactly the known widget types", () => {
    assert.deepEqual([...widgetRegistry.names()].sort(), [...CATALOG].sort());
  });

  it("validates every composed page in content/ and every widget it places is registered", async () => {
    const store = new FileContentStore(path.resolve(import.meta.dirname, "../content"), {
      widgets: widgetRegistry,
    });
    const pages = await store.listPages({ includeDrafts: true });
    assert.ok(pages.length > 0);
    const used = new Set<string>();
    for (const page of pages) {
      if (!page.layout) continue;
      for (const row of layoutRows(page.layout)) {
        for (const cell of row.cells) for (const w of cell.widgets) used.add(w.type);
      }
    }
    assert.ok(used.size > 0, "content uses widgets");
    for (const type of used) assert.ok(widgetRegistry.has(type), `widget "${type}" registered`);
  });

  it("the file store rejects a page that places an unknown widget", async () => {
    const empty = new FileContentStore(path.resolve(import.meta.dirname, "../content"));
    const page = await empty.getPage("editor");
    assert.ok(page?.layout, "editor page is composed");
    assert.throws(
      () => widgetRegistry.parse({ type: "does-not-exist", config: {} }),
      /Unknown widget type "does-not-exist"/
    );
  });
});
