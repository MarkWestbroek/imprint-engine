import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_RELATION_RULES } from "../src/core-content-types";
import { extractRefs, validateReferences } from "../src/relations";

/** Characterisation of the soft-reference integrity rules (architecture.md §3b). */
describe("extractRefs", () => {
  const release = {
    product: "alpha",
    components: [
      { component: "c1", version: "v1" },
      { component: "c2", version: "v2" },
    ],
    tags: ["x", "", "y"],
    nested: { list: ["n1"] },
  };

  it("follows scalar, array and array-of-object paths", () => {
    assert.deepEqual(extractRefs("product", release), ["alpha"]);
    assert.deepEqual(extractRefs("components[].component", release), ["c1", "c2"]);
    assert.deepEqual(extractRefs("tags[]", release), ["x", "y"], "empty strings are not refs");
    assert.deepEqual(extractRefs("nested.list[]", release), ["n1"]);
  });

  it("yields nothing for missing fields or non-string values", () => {
    assert.deepEqual(extractRefs("missing", release), []);
    assert.deepEqual(extractRefs("missing[].x", release), []);
    assert.deepEqual(extractRefs("components[]", release), [], "objects are not slugs");
    assert.deepEqual(extractRefs("product", null), []);
  });
});

describe("validateReferences", () => {
  const existing = async (type: string) =>
    new Set(type === "product" ? ["alpha"] : type === "component" ? ["c1"] : []);

  it("reports every enforced reference whose target is missing", async () => {
    const missing = await validateReferences(
      DEFAULT_RELATION_RULES,
      "release",
      { product: "ghost", components: [{ component: "c1" }, { component: "c9" }] },
      existing
    );
    assert.deepEqual(missing, [
      { field: "product", toType: "product", slug: "ghost" },
      { field: "components[].component", toType: "component", slug: "c9" },
    ]);
  });

  it("ignores advisory rules and types without rules", async () => {
    const advisory = [{ fromType: "release", field: "product", toType: "product", enforce: false }];
    assert.deepEqual(await validateReferences(advisory, "release", { product: "ghost" }, existing), []);
    assert.deepEqual(await validateReferences(DEFAULT_RELATION_RULES, "page", { slug: "x" }, existing), []);
  });

  it("loads the slugs of a target type once per call", async () => {
    let calls = 0;
    const counting = async (type: string) => {
      calls++;
      return existing(type);
    };
    await validateReferences(
      DEFAULT_RELATION_RULES,
      "component",
      { children: ["c1", "c2", "c3"] },
      counting
    );
    assert.equal(calls, 1);
  });
});
