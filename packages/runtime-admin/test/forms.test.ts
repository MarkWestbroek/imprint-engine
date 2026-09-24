import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { coreContentTypes } from "@imprint/content-core";

import { contentFormSchema, widgetFormSchemas } from "../src/forms";

describe("form schemas", () => {
  it("are plain JSON, with nothing zod hung on them (React refuses class-like client props)", () => {
    const schema = contentFormSchema(coreContentTypes.get("product"));
    assert.deepEqual(JSON.parse(JSON.stringify(schema)), schema);
    const slug = (schema.properties as Record<string, object>).slug;
    assert.deepEqual(Object.getOwnPropertyNames(slug).filter((n) => n.startsWith("~")), []);
    assert.equal((slug as { type?: string }).type, "string");
  });

  it("turn a widget catalogue into per-widget forms", () => {
    const forms = widgetFormSchemas([
      { name: "hero", label: "Hero", version: "1.1.0", help: "Big title", configSchema: z.object({ title: z.string() }) },
    ]);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].name, "hero");
    assert.equal(((forms[0].schema.properties as Record<string, { type?: string }>).title).type, "string");
  });

  it("leave a field the form cannot render as an empty schema (a JSON box)", () => {
    const menu = contentFormSchema(coreContentTypes.get("wiki-page"));
    assert.equal(typeof menu.properties, "object");
    const page = contentFormSchema(coreContentTypes.get("page"));
    assert.ok("access" in (page.properties as object), "the access field reaches the form");
  });
});
