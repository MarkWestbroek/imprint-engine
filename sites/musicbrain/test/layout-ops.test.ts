import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyOp, MAX_CELLS, MAX_SPAN, type PageDraft } from "../src/lib/layout-ops";

/** Characterisation of the studio's pure draft mutations (architecture.md §5). */
const W = (name: string) => ({ type: name, config: { name } });

function draft(): PageDraft {
  return {
    meta: { slug: "p", title: "P" },
    body: "intro",
    rows: [
      { cells: [{ span: 1, widgets: [W("a"), W("b")] }, { span: 2, widgets: [W("c")] }] },
      { cells: [{ span: 1, widgets: [] }] },
    ],
  };
}

describe("applyOp", () => {
  it("never mutates its input", () => {
    const before = draft();
    const snapshot = structuredClone(before);
    applyOp(before, { kind: "widget-delete", path: { r: 0, c: 0, w: 0 } });
    applyOp(before, { kind: "row-add", at: 0 });
    assert.deepEqual(before, snapshot);
  });

  it("meta merges, body replaces", () => {
    const d = applyOp(applyOp(draft(), { kind: "meta", patch: { title: "Q" } }), { kind: "body", body: "x" });
    assert.deepEqual(d.meta, { slug: "p", title: "Q" });
    assert.equal(d.body, "x");
  });

  it("widget-add appends an empty-config widget; widget-config replaces the config", () => {
    let d = applyOp(draft(), { kind: "widget-add", r: 1, c: 0, type: "hero" });
    assert.deepEqual(d.rows[1].cells[0].widgets, [{ type: "hero", config: {} }]);
    d = applyOp(d, { kind: "widget-config", path: { r: 1, c: 0, w: 0 }, config: { title: "t" } });
    assert.deepEqual(d.rows[1].cells[0].widgets[0].config, { title: "t" });
    assert.deepEqual(applyOp(d, { kind: "widget-add", r: 9, c: 0, type: "x" }), d, "out of range = no-op");
  });

  it("widget-move swaps within a cell and hops between cells; edges are no-ops", () => {
    const names = (d: PageDraft, r: number, c: number) => d.rows[r].cells[c].widgets.map((w) => w.type);
    let d = applyOp(draft(), { kind: "widget-move", path: { r: 0, c: 0, w: 0 }, dir: "down" });
    assert.deepEqual(names(d, 0, 0), ["b", "a"]);
    d = applyOp(d, { kind: "widget-move", path: { r: 0, c: 0, w: 0 }, dir: "up" });
    assert.deepEqual(names(d, 0, 0), ["b", "a"], "already at top");
    d = applyOp(d, { kind: "widget-move", path: { r: 0, c: 0, w: 1 }, dir: "right" });
    assert.deepEqual(names(d, 0, 0), ["b"]);
    assert.deepEqual(names(d, 0, 1), ["c", "a"], "appended to the target cell");
    d = applyOp(d, { kind: "widget-move", path: { r: 0, c: 0, w: 0 }, dir: "left" });
    assert.deepEqual(names(d, 0, 0), ["b"], "no cell to the left");
  });

  it("widget-delete removes exactly that widget", () => {
    const d = applyOp(draft(), { kind: "widget-delete", path: { r: 0, c: 0, w: 0 } });
    assert.deepEqual(d.rows[0].cells[0].widgets, [W("b")]);
  });

  it("row-add inserts a one-cell row at the index", () => {
    const d = applyOp(draft(), { kind: "row-add", at: 1 });
    assert.equal(d.rows.length, 3);
    assert.deepEqual(d.rows[1], { cells: [{ span: 1, widgets: [] }] });
  });

  it("row-delete keeps the widgets: they move to the previous row's first cell", () => {
    let d = applyOp(draft(), { kind: "row-delete", r: 0 });
    assert.equal(d.rows.length, 1);
    assert.deepEqual(d.rows[0].cells[0].widgets, [W("a"), W("b"), W("c")], "row 0 removed → strays into new row 0");
    d = applyOp(draft(), { kind: "row-delete", r: 1 });
    assert.equal(d.rows.length, 1, "empty row just goes");
    assert.deepEqual(applyOp(draft(), { kind: "row-delete", r: 5 }), draft(), "out of range = no-op");
  });

  it("row-delete of the last remaining row with widgets recreates a row for them", () => {
    const single: PageDraft = { meta: {}, body: "", rows: [{ cells: [{ span: 1, widgets: [W("x")] }] }] };
    const d = applyOp(single, { kind: "row-delete", r: 0 });
    assert.deepEqual(d.rows, [{ cells: [{ span: 1, widgets: [W("x")] }] }]);
  });

  it("cell-add caps a row at MAX_CELLS", () => {
    let d = draft();
    for (let i = 0; i < 6; i++) d = applyOp(d, { kind: "cell-add", r: 1, at: 0 });
    assert.equal(d.rows[1].cells.length, MAX_CELLS);
  });

  it("cell-delete merges the widgets into the neighbour; the only cell deletes the row", () => {
    let d = applyOp(draft(), { kind: "cell-delete", r: 0, c: 1 });
    assert.equal(d.rows[0].cells.length, 1);
    assert.deepEqual(d.rows[0].cells[0].widgets, [W("a"), W("b"), W("c")]);
    d = applyOp(draft(), { kind: "cell-delete", r: 0, c: 0 });
    assert.deepEqual(d.rows[0].cells[0].widgets, [W("c"), W("a"), W("b")], "first cell merges rightwards");
    d = applyOp(draft(), { kind: "cell-delete", r: 1, c: 0 });
    assert.equal(d.rows.length, 1, "single cell → row-delete");
  });

  it("cell-resize clamps span to 1..MAX_SPAN", () => {
    let d = draft();
    for (let i = 0; i < 6; i++) d = applyOp(d, { kind: "cell-resize", r: 0, c: 0, delta: 1 });
    assert.equal(d.rows[0].cells[0].span, MAX_SPAN);
    for (let i = 0; i < 6; i++) d = applyOp(d, { kind: "cell-resize", r: 0, c: 0, delta: -1 });
    assert.equal(d.rows[0].cells[0].span, 1);
  });
});
