import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LAYOUT_PRESETS, layoutRows } from "../src/widgets/templates";

/**
 * Characterisation of the renderer's layout normalisation: PageRenderer and
 * the studio both go through layoutRows(), so this pins what a stored layout
 * becomes on screen (architecture.md §3).
 */
describe("layoutRows", () => {
  const w = (name: string, region = "main") => ({ type: name, config: { n: name }, region });

  it("passes rows through untouched when present", () => {
    const rows = [{ cells: [{ span: 2, widgets: [{ type: "text", config: {} }] }] }];
    assert.equal(layoutRows({ rows, template: "sidebar-left", widgets: [w("x")] }), rows);
  });

  it("maps a legacy template + regions onto one row of cells", () => {
    const rows = layoutRows({
      template: "sidebar-left",
      widgets: [w("nav", "sidebar"), w("body", "main"), w("more", "main")],
    });
    assert.deepEqual(rows, [
      {
        cells: [
          { span: 1, widgets: [{ type: "nav", config: { n: "nav" } }] },
          {
            span: 2,
            widgets: [
              { type: "body", config: { n: "body" } },
              { type: "more", config: { n: "more" } },
            ],
          },
        ],
      },
    ]);
  });

  it("knows the four legacy templates and their spans", () => {
    const spans = (template: string) => layoutRows({ template })[0].cells.map((c) => c.span);
    assert.deepEqual(spans("single"), [1]);
    assert.deepEqual(spans("sidebar-left"), [1, 2]);
    assert.deepEqual(spans("sidebar-right"), [2, 1]);
    assert.deepEqual(spans("three-column"), [1, 2, 1]);
  });

  it("falls back to single for a missing or unknown template; region defaults to main", () => {
    assert.deepEqual(layoutRows({}), [{ cells: [{ span: 1, widgets: [] }] }]);
    const rows = layoutRows({ template: "nope", widgets: [w("a"), w("b", "sidebar")] });
    assert.equal(rows[0].cells.length, 1);
    assert.deepEqual(
      rows[0].cells[0].widgets.map((x) => x.type),
      ["a"],
      "widgets in regions the template lacks are dropped from the render"
    );
    assert.deepEqual(layoutRows({ rows: [] }), [{ cells: [{ span: 1, widgets: [] }] }], "empty rows = legacy path");
  });

  it("offers four empty presets", () => {
    assert.deepEqual(
      LAYOUT_PRESETS.map((p) => p.rows[0].cells.map((c) => c.span)),
      [[1], [1, 2], [2, 1], [1, 1, 1]]
    );
  });
});
