import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ContentTypeRegistry, coreContentTypeDefinitions, guardReads, inProcessPdp, type AuthzenSubject } from "@imprint/content-core";
import { createMemoryDb, MemoryContentStore } from "@imprint/content-core/memory-store";
import type { AdminContext } from "@imprint/runtime-admin";
import { patchesApiItem } from "../src/api";
import { patchesContentTypes } from "../src/content-types";
import { PatchSchema, type Patch } from "../src/schemas";

/**
 * `PATCH /api/patches/<slug>`: the editor updates its own patch on the slug it
 * already has, and a content change sends the patch back to `voorstel` — also
 * from `centraal`, so one approval never covers content that changed later
 * (the decision of 11-10, docs/backlog.md).
 */

const requires = { editorVersion: "0.5.48", firmwareContract: "0.5.94", moduleTypes: ["ladder"] };

const patchItem = (over: Partial<Patch> = {}): Patch =>
  PatchSchema.parse({ slug: "warm-pad", title: "Warm pad", file: "asset:warm-pad", requires, author: "ada", ...over }) as Patch;

let store: MemoryContentStore;
let admin: AdminContext;

/** Two accounts: `ada` owns the patch, `bo` does not. Both are readers with the scope. */
const tokens: Record<string, { user: { name: string; role: string }; scopes: string[] }> = {
  "imp_ada": { user: { name: "ada", role: "reader" }, scopes: ["patch:propose"] },
  "imp_bo": { user: { name: "bo", role: "reader" }, scopes: ["patch:propose"] },
  "imp_ada-no-scope": { user: { name: "ada", role: "reader" }, scopes: ["media:read"] },
};

beforeEach(async () => {
  store = new MemoryContentStore(createMemoryDb(), { contentTypes: ContentTypeRegistry.of(coreContentTypeDefinitions, patchesContentTypes) });
  admin = {
    imprint: {
      writableStore: store,
      pdp: inProcessPdp,
      storeFor: (subject: AuthzenSubject) => guardReads(store, subject, inProcessPdp),
      media: { maxBytes: {}, cors: [] },
      users: { authenticate: async (token: string) => tokens[token] ?? null },
    },
  } as unknown as AdminContext;
});

const put = (p: Patch) => store.putItem("patch", p.slug, p, { lang: "en", by: "test" });

async function send(body: unknown, token = "imp_ada", slug = "warm-pad") {
  const req = new Request(`https://musicbrain.nl/api/patches/${slug}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const res = await patchesApiItem(admin, req, slug);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const stored = async (slug = "warm-pad") => PatchSchema.parse((await store.getItem("patch", slug, "en"))!.data) as Patch;

describe("updating a patch on its own slug", () => {
  it("a content change in centraal sends it back to voorstel, and it leaves the public set", async () => {
    await put(patchItem({ pool: "centraal", license: "CC0" }));
    const { status, body } = await send({ file: "asset:warm-pad-v2", description: "Nu met meer lucht" });
    assert.equal(status, 200);
    assert.equal(body.pool, "voorstel");
    assert.equal(body.requeued, true);
    assert.deepEqual(body.changed, ["description", "file"]);
    const p = await stored();
    assert.equal(p.file, "asset:warm-pad-v2");
    // Back in the queue means private again: the central page no longer shows it.
    assert.deepEqual([p.pool, p.access, p.license], ["voorstel", "private", "CC0"]);
  });

  it("the same change twice writes nothing the second time: a seed script may run again", async () => {
    await put(patchItem({ pool: "centraal", license: "CC0" }));
    await send({ title: "Warm pad II" });
    const versions = (await store.listVersions("patch", "warm-pad", "en")).length;
    const { status, body } = await send({ title: "Warm pad II" });
    assert.equal(status, 200);
    assert.deepEqual([body.changed, body.requeued, body.pool], [[], false, "voorstel"]);
    assert.equal((await store.listVersions("patch", "warm-pad", "en")).length, versions);
  });

  it("history keeps every version: the patch is one identity, updated in place", async () => {
    await put(patchItem({ pool: "experimenteel" }));
    await send({ title: "Warm pad II" });
    const versions = await store.listVersions("patch", "warm-pad", "en");
    assert.equal(versions.length, 2);
    assert.deepEqual(versions.map((v) => (v.data as Patch).title).sort(), ["Warm pad", "Warm pad II"]);
  });

  it("a field left out stays as it is — an update never empties by omission", async () => {
    await put(patchItem({ pool: "voorstel", tags: ["klank/pad"], takes: ["take-1"], syx: "asset:warm-pad-syx", description: "Oud" }));
    const { body } = await send({ title: "Warm pad II" });
    assert.deepEqual(body.changed, ["title"]);
    const p = await stored();
    assert.deepEqual([p.tags, p.takes, p.syx, p.description, p.license], [["klank/pad"], ["take-1"], "asset:warm-pad-syx", "Oud", "CC-BY-4.0"]);
  });

  it("a private patch and a question keep their pool: neither is waiting for a place in the set", async () => {
    await put(patchItem({ pool: "prive" }));
    await put(patchItem({ slug: "dof", pool: "vraag", question: "Waarom klinkt dit dof?" }));
    assert.equal((await send({ title: "Alleen voor mij" })).body.pool, "prive");
    const q = await send({ question: "Waarom klinkt dit dof bij lage noten?" }, "imp_ada", "dof");
    assert.deepEqual([q.body.pool, q.body.requeued], ["vraag", false]);
  });

  it("only its author: someone else's patch is theirs to change, and a private one does not even exist for them", async () => {
    await put(patchItem({ pool: "centraal", license: "CC0" }));
    assert.equal((await send({ title: "Van mij nu" }, "imp_bo")).status, 403);
    await put(patchItem({ slug: "geheim", pool: "prive" }));
    assert.equal((await send({ title: "Van mij nu" }, "imp_bo", "geheim")).status, 404);
    assert.equal((await stored()).title, "Warm pad");
  });

  it("token and scope first, and nothing at all without a patch", async () => {
    await put(patchItem());
    assert.equal((await send({ title: "x" }, "")).status, 401);
    assert.equal((await send({ title: "x" }, "imp_ada-no-scope")).status, 403);
    assert.equal((await send({ title: "x" }, "imp_ada", "bestaat-niet")).status, 404);
  });

  it("CC0 cannot be withdrawn, and a patch cannot be derived from itself", async () => {
    await put(patchItem({ pool: "centraal", license: "CC0" }));
    assert.equal((await send({ license: "CC-BY-4.0" })).status, 409);
    assert.equal((await send({ derivedFrom: "warm-pad" })).status, 400);
    assert.equal((await stored()).license, "CC0");
  });

  it("the body is checked, and the pool is never in it", async () => {
    await put(patchItem({ pool: "centraal", license: "CC0" }));
    assert.equal((await send({ file: "https://elders/patch.json" })).status, 400);
    // A pool in the body is ignored, not obeyed: it is simply not a field here.
    const { body } = await send({ pool: "centraal", title: "Warm pad II" } as unknown);
    assert.deepEqual([body.changed, body.pool], [["title"], "voorstel"]);
  });

  it("promoting and updating in one call is refused: which pool would win?", async () => {
    await put(patchItem({ pool: "prive" }));
    const { status, body } = await send({ kind: "proposal", title: "Warm pad II" });
    assert.equal(status, 400);
    assert.match(String(body.error), /not both in one call \(title\)/);
    // The old promote body still works, question text and all.
    const promoted = await send({ kind: "question", question: "Waarom klinkt dit dof?" });
    assert.deepEqual([promoted.status, promoted.body.pool], [200, "vraag"]);
  });
});
