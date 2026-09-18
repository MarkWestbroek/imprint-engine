import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CONTENT_TYPES, ContentTypeCatalog } from "../src/content-types";

describe("ContentTypeCatalog", () => {
  it("defaults to every available type, in catalogue order", () => {
    assert.deepEqual(new ContentTypeCatalog().types(), Object.keys(CONTENT_TYPES));
  });

  it("narrows to what the site switched on, keeping catalogue order", () => {
    const catalog = new ContentTypeCatalog(["theme", "page", "relations"]);
    assert.deepEqual(catalog.types(), ["page", "theme", "relations"]);
    assert.deepEqual(catalog.types("ingestable"), ["page"]);
    assert.equal(catalog.has("page", "editable"), true);
    assert.equal(catalog.has("product"), false, "available but not active");
    assert.equal(catalog.has("relations", "listable"), false, "active but not listable");
    assert.equal(catalog.has("constructor"), false, "not fooled by object prototype keys");
  });

  it("rejects a type the model does not know", () => {
    assert.throws(() => new ContentTypeCatalog(["page", "blog"]), /Unknown content type "blog"/);
  });

  it("characterises the lists the admin used to keep by hand", () => {
    const catalog = new ContentTypeCatalog();
    const sorted = (types: string[]) => [...types].sort();
    assert.deepEqual(
      sorted(catalog.types("listable")),
      sorted(["site", "product", "component", "board-spec", "release", "page", "menu", "theme", "planning-item", "wiki", "wiki-folder", "wiki-page"])
    );
    assert.deepEqual(
      sorted(catalog.types("editable")),
      sorted(["site", "product", "component", "board-spec", "release", "page", "menu", "theme", "wiki", "wiki-folder", "wiki-page"])
    );
    assert.deepEqual(
      sorted(catalog.types("ingestable")),
      sorted(["product", "component", "board-spec", "release", "page", "wiki", "wiki-folder", "wiki-page"])
    );
    assert.deepEqual(catalog.types("overview"), ["page", "product", "component", "board-spec", "release", "planning", "wiki", "menu", "theme"]);
  });
});
