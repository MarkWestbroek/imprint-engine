import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { LayoutCellSchema, PageLayoutSchema, WidgetTypeRegistry } from "../src/widgets";

/** Characterisation of the core widget model (architecture.md §3). */
describe("WidgetTypeRegistry", () => {
  const registry = () =>
    new WidgetTypeRegistry()
      .register({ name: "text", configSchema: z.object({ markdown: z.string() }) })
      .register({ name: "spacer", configSchema: z.object({ size: z.number().default(1) }) });

  it("refuses duplicate registrations", () => {
    assert.throws(
      () => registry().register({ name: "text", configSchema: z.object({}) }),
      /already registered/
    );
  });

  it("lists names in registration order", () => {
    assert.deepEqual(registry().names(), ["text", "spacer"]);
    assert.ok(registry().has("text"));
    assert.ok(!registry().has("hero"));
  });

  it("parse: unknown type names the registered types in the error", () => {
    assert.throws(
      () => registry().parse({ type: "hero", config: {} }),
      /Unknown widget type "hero" \(registered: text, spacer\)/
    );
  });

  it("parse: invalid config fails loudly; valid config gets schema defaults", () => {
    assert.throws(() => registry().parse({ type: "text", config: {} }), /Invalid config for widget "text"/);
    assert.deepEqual(registry().parse({ type: "spacer", config: {} }), {
      type: "spacer",
      config: { size: 1 },
    });
  });

  it("parseLayout validates rows and legacy placements, keeping the rest", () => {
    const layout = PageLayoutSchema.parse({
      template: "single",
      widgets: [{ type: "spacer", config: {}, region: "main" }],
      rows: [{ cells: [{ widgets: [{ type: "text", config: { markdown: "x" } }] }] }],
    });
    const parsed = registry().parseLayout(layout);
    assert.equal(parsed.template, "single");
    assert.deepEqual(parsed.widgets?.[0], { type: "spacer", config: { size: 1 }, region: "main" });
    assert.equal(parsed.rows?.[0].cells[0].span, 1, "cell span default");
  });
});

describe("layout schemas", () => {
  it("cell span is 1..4 and defaults to 1; a row needs at least one cell", () => {
    assert.equal(LayoutCellSchema.parse({}).span, 1);
    assert.throws(() => LayoutCellSchema.parse({ span: 5 }));
    assert.throws(() => PageLayoutSchema.parse({ rows: [{ cells: [] }] }));
  });

  it("legacy placements default their region to main", () => {
    const layout = PageLayoutSchema.parse({ widgets: [{ type: "text" }] });
    assert.deepEqual(layout.widgets?.[0], { type: "text", config: {}, region: "main" });
  });
});
