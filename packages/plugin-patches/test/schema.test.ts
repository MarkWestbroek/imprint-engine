import assert from "node:assert/strict";
import { test } from "node:test";
import { patchSlug } from "../src/href";
import { PatchInput, PatchSchema } from "../src/schemas";

const base = {
  slug: "warm-pad",
  title: "Warm pad",
  file: "asset:warm-pad-patch",
  requires: { editorVersion: "0.5.48", firmwareContract: "0.5.94", moduleTypes: ["ladder", "sid"] },
};

test("access follows the pool: a proposal is private, the rest public — whatever the input says", () => {
  const proposal = PatchSchema.parse({ ...base, pool: "voorstel", access: "public" });
  assert.equal(proposal.access, "private");
  const lab = PatchSchema.parse({ ...base, pool: "experimenteel", access: "private" });
  assert.deepEqual([lab.access, lab.license, lab.answered, lab.tags], ["public", "CC-BY-4.0", false, []]);
});

test("centraal needs CC0; a question needs its text", () => {
  assert.equal(PatchSchema.safeParse({ ...base, pool: "centraal" }).success, false);
  assert.equal(PatchSchema.safeParse({ ...base, pool: "centraal", license: "CC0" }).success, true);
  assert.equal(PatchSchema.safeParse({ ...base, pool: "vraag" }).success, false);
  assert.equal(PatchSchema.safeParse({ ...base, pool: "vraag", question: "Waarom klinkt dit dof?" }).success, true);
});

test("the editor's input never carries a pool or an author; file is an asset reference", () => {
  const ok = PatchInput.safeParse({ title: "Warm pad", file: "asset:x", requires: base.requires });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.kind, "proposal");
  assert.equal(PatchInput.safeParse({ title: "x", file: "https://elders/patch.json", requires: base.requires }).success, false);
  assert.equal("pool" in PatchInput.shape, false);
  assert.equal("author" in PatchInput.shape, false);
});

test("slugs from titles", () => {
  assert.equal(patchSlug("Warm Pad — Zoë's #2"), "warm-pad-zoe-s-2");
  assert.equal(patchSlug("  FM Bell  "), "fm-bell");
});

test("a private patch (pool prive) is private like a proposal, and stays out of the public reach", () => {
  const p = PatchSchema.parse({ ...base, pool: "prive", access: "public" });
  assert.equal(p.access, "private");
  const input = PatchInput.parse({ kind: "private", title: "Alleen voor mij", file: "asset:x", requires: base.requires });
  assert.equal(input.kind, "private");
});

test("the front is an optional asset reference, in the input and the item", () => {
  const withFront = PatchInput.safeParse({ title: "Warm pad", file: "asset:x", front: "asset:warm-pad-front", requires: base.requires });
  assert.equal(withFront.success, true);
  assert.equal(withFront.success && withFront.data.front, "asset:warm-pad-front");
  assert.equal(PatchInput.safeParse({ title: "Warm pad", file: "asset:x", front: "https://elders/front.svg", requires: base.requires }).success, false);
  const item = PatchSchema.parse({ ...base, pool: "experimenteel", front: "asset:warm-pad-front" });
  assert.equal(item.front, "asset:warm-pad-front");
});
