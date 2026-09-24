import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planningContentTypes } from "../src/content-types";
import { bucketInto, computeMove, groupIntoColumns } from "../src/planning";
import { PlanningItemSchema, PlanningSchema, type PlanningItem } from "../src/schemas";

const planning = PlanningSchema.parse({ slug: "roadmap", name: "Roadmap" });
const card = (slug: string, status: string, order: number): PlanningItem =>
  PlanningItemSchema.parse({ slug, title: slug, planning: "roadmap", status, order });

describe("planning board logic", () => {
  it("groups cards into the planning's phases, unknown phases in a trailing Other", () => {
    const cols = groupIntoColumns(planning, [card("a", "backlog", 1), card("b", "backlog", 0), card("x", "gone", 0)]);
    assert.deepEqual(cols.map((c) => c.key), ["backlog", "in-progress", "beta", "done", "__other"]);
    assert.deepEqual(cols[0].cards.map((c) => c.slug), ["b", "a"]);
    assert.deepEqual(cols[4].cards.map((c) => c.slug), ["x"]);
  });

  it("moving a card renumbers source and target columns and reports only what changed", () => {
    const items = [card("a", "backlog", 0), card("b", "backlog", 1), card("c", "beta", 0)];
    const patches = computeMove(planning, items, "a", "beta", 1);
    assert.deepEqual(patches, [
      { slug: "a", status: "beta", order: 1 },
      { slug: "b", status: "backlog", order: 0 },
    ]);
    assert.deepEqual(computeMove(planning, items, "nope", "beta", 0), []);
  });

  it("buckets any records by a key", () => {
    const cols = bucketInto([{ key: "x", label: "X" }], [{ k: "x" }, { k: "y" }], (r) => r.k);
    assert.deepEqual(cols.map((c) => [c.key, c.records.length]), [["x", 1], ["__other", 1]]);
  });

  it("brings its two content types with their relation rules", () => {
    assert.deepEqual(planningContentTypes.map((d) => d.name), ["planning", "planning-item"]);
    assert.equal(planningContentTypes.flatMap((d) => d.relations ?? []).length, 3);
  });
});
