import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { ContentTypeCatalog, ContentTypeRegistry } from "../src/content-types";
import { coreContentTypeDefinitions, coreContentTypes, DEFAULT_RELATION_RULES } from "../src/core-content-types";

describe("ContentTypeRegistry", () => {
  it("knows the core types in order, refuses a duplicate, validates with the schema", () => {
    assert.deepEqual(coreContentTypes.names(), coreContentTypeDefinitions.map((d) => d.name));
    assert.throws(() => ContentTypeRegistry.of(coreContentTypeDefinitions, [coreContentTypeDefinitions[0]]), /defined twice/);
    assert.equal((coreContentTypes.validate("menu", { name: "main" }) as { name: string }).name, "main");
    assert.throws(() => coreContentTypes.validate("blog", {}), /Unknown content type "blog"/);
    assert.throws(() => coreContentTypes.validate("product", { slug: "x" }), /name|tagline/);
  });

  it("derives the natural key per type", () => {
    assert.equal(coreContentTypes.slugOf("page", { slug: "about" }), "about");
    assert.equal(coreContentTypes.slugOf("release", { project: "fw", version: "1.2" }), "fw-1.2");
    assert.equal(coreContentTypes.slugOf("site", {}), "site");
    assert.equal(coreContentTypes.slugOf("menu", { name: "main" }), "main");
  });

  it("collects the relation rules of its definitions (the seeded defaults)", () => {
    assert.equal(DEFAULT_RELATION_RULES.length, 5);
    assert.ok(DEFAULT_RELATION_RULES.some((r) => r.fromType === "release" && r.toType === "product"));
  });

  it("takes a plugin's type next to the core's", () => {
    const registry = ContentTypeRegistry.of(coreContentTypeDefinitions, [
      { name: "recipe", schema: z.object({ slug: z.string(), title: z.string() }), label: "Recipes", flags: ["listable"], relations: [{ fromType: "recipe", field: "product", toType: "product", enforce: true }] },
    ]);
    assert.ok(registry.has("recipe"));
    assert.equal(registry.relations().length, 6);
    assert.equal(registry.info("recipe").listable, true);
  });
});

describe("ContentTypeCatalog", () => {
  it("defaults to every registered type, in registry order", () => {
    assert.deepEqual(new ContentTypeCatalog(coreContentTypes).types(), coreContentTypes.names());
  });

  it("narrows to what the site switched on, keeping registry order", () => {
    const catalog = new ContentTypeCatalog(coreContentTypes, ["theme", "page", "relations"]);
    assert.deepEqual(catalog.types(), ["page", "theme", "relations"]);
    assert.deepEqual(catalog.types("ingestable"), ["page"]);
    assert.equal(catalog.has("page", "editable"), true);
    assert.equal(catalog.has("product"), false, "available but not active");
    assert.equal(catalog.has("relations", "listable"), false, "active but not listable");
    assert.equal(catalog.has("constructor"), false, "not fooled by object prototype keys");
  });

  it("rejects a type the registry does not know", () => {
    assert.throws(() => new ContentTypeCatalog(coreContentTypes, ["page", "blog"]), /Unknown content type "blog"/);
  });

  it("characterises the lists the admin used to keep by hand", () => {
    const catalog = new ContentTypeCatalog(coreContentTypes);
    const sorted = (types: string[]) => [...types].sort();
    assert.deepEqual(
      sorted(catalog.types("listable")),
      sorted(["site", "product", "component", "board-spec", "release", "page", "menu", "theme"])
    );
    assert.deepEqual(
      sorted(catalog.types("editable")),
      sorted(["site", "product", "component", "board-spec", "release", "page", "menu", "theme"])
    );
    assert.deepEqual(
      sorted(catalog.types("ingestable")),
      sorted(["product", "component", "board-spec", "release", "page"])
    );
    assert.deepEqual(catalog.types("overview"), ["page", "product", "component", "board-spec", "release", "menu", "theme"]);
    assert.deepEqual(catalog.types("viewable"), ["product", "component", "board-spec", "release"]);
  });
});
