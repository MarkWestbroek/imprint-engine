import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeItinerary } from "../src/itinerary";
import { ReleaseSchema } from "../src/schemas";

/** Characterisation of the derived ProductComponentItinerary (architecture.md §3b). */
describe("computeItinerary", () => {
  const releases = [
    { project: "fw", version: "1.1.0", date: "2026-02-01", components: [{ component: "b", version: "v2" }] },
    {
      project: "fw",
      version: "1.0.0",
      date: "2026-01-01",
      components: [
        { component: "a", version: "v1" },
        { component: "b", version: "v1" },
      ],
    },
    { project: "fw", version: "1.2.0", date: "2026-03-01", components: [{ component: "b", version: "v3" }] },
  ].map((r) => ReleaseSchema.parse(r));

  it("spans first to last release per component, in release-date order", () => {
    assert.deepEqual(computeItinerary(releases), [
      { component: "a", start: "2026-01-01", end: "2026-01-01", firstRelease: "1.0.0", lastRelease: "1.0.0", versions: ["v1"] },
      { component: "b", start: "2026-01-01", end: null, firstRelease: "1.0.0", lastRelease: "1.2.0", versions: ["v1", "v2", "v3"] },
    ]);
  });

  it("is empty without releases and does not mutate its input", () => {
    assert.deepEqual(computeItinerary([]), []);
    const copy = [...releases];
    computeItinerary(releases);
    assert.deepEqual(releases, copy);
  });
});
