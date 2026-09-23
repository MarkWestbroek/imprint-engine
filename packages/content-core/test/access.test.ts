import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  ANONYMOUS,
  guardReads,
  inProcessPdp,
  permit,
  permitted,
  userSubject,
  type PolicyDecisionPoint,
} from "../src/access";
import { createMemoryDb, MemoryContentStore } from "../src/memory-store";
import { legacyVisibilityToAccess, WikiSchema } from "../src/schemas";
import { seedFixtures } from "./db-test-helpers";

const page = (id: string) => ({ type: "page", id, properties: { access: "public" } });
const restricted = (id: string) => ({ type: "page", id, properties: { access: "restricted" } });
const read = { name: "read" };
const update = { name: "update" };

describe("inProcessPdp: the fixed rule set", () => {
  const editor = userSubject("ed", "editor");
  const reader = userSubject("ria", "reader");

  it("a visitor reads public content only and never writes", async () => {
    assert.equal((await inProcessPdp.evaluate({ subject: ANONYMOUS, action: read, resource: page("a") })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: ANONYMOUS, action: read, resource: restricted("a") })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: ANONYMOUS, action: update, resource: page("a") })).decision, false);
  });

  it("a reader reads everything, writes nothing; an editor writes; an admin does anything", async () => {
    assert.equal((await inProcessPdp.evaluate({ subject: reader, action: read, resource: restricted("a") })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: reader, action: update, resource: page("a") })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: editor, action: update, resource: restricted("a") })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: userSubject("m", "admin"), action: { name: "delete" }, resource: restricted("a") })).decision, true);
  });

  it("answers a batch in order", async () => {
    const answers = await inProcessPdp.evaluations([
      { subject: ANONYMOUS, action: read, resource: page("a") },
      { subject: ANONYMOUS, action: read, resource: restricted("b") },
    ]);
    assert.deepEqual(answers.map((a) => a.decision), [true, false]);
  });
});

describe("permit: the PEP", () => {
  const broken: PolicyDecisionPoint = {
    evaluate: async () => {
      throw new Error("PDP unreachable");
    },
    evaluations: async () => {
      throw new Error("PDP unreachable");
    },
  };

  it("public reads never reach the PDP", async () => {
    assert.equal(await permit(broken, ANONYMOUS, "read", page("a")), true);
  });

  it("an unreachable PDP is a no for restricted reads and for writes", async () => {
    assert.equal(await permit(broken, userSubject("m", "admin"), "read", restricted("a")), false);
    assert.equal(await permit(broken, userSubject("m", "admin"), "update", page("a")), false);
    const items = [{ slug: "a" }, { slug: "b", access: "restricted" }];
    assert.deepEqual(await permitted(broken, userSubject("m", "admin"), "page", items, (i) => i.slug), [{ slug: "a" }]);
  });
});

describe("guardReads: the store as one subject sees it", () => {
  const db = createMemoryDb();
  const raw = new MemoryContentStore(db);
  before(async () => {
    await seedFixtures(raw);
    await raw.putItem("page", "members", { slug: "members", title: "Members only", body: "", access: "restricted" });
    await raw.putItem("product", "secret", {
      slug: "secret", name: "Secret", tagline: "hush", status: "beta", access: "restricted",
    });
    await raw.putItem("planning-item", "card", {
      slug: "card", title: "Card", planning: "x", access: "restricted",
    });
  });

  it("a visitor sees no restricted item in any list or get, nor through listItems/getItem", async () => {
    const store = guardReads(raw, ANONYMOUS, inProcessPdp);
    assert.equal((await store.listPages()).some((p) => p.slug === "members"), false);
    assert.equal(await store.getPage("members"), null);
    assert.equal((await store.listProducts()).some((p) => p.slug === "secret"), false);
    assert.equal(await store.getProduct("secret"), null);
    assert.equal((await store.listItems("planning-item")).length, 0);
    assert.equal(await store.getItem("page", "members"), null);
    assert.ok(await store.getPage("about"), "public content is untouched");
    assert.ok((await store.listItems("page")).some((r) => r.slug === "about"));
  });

  it("a reader sees it all; the wrapper leaves writes and history alone", async () => {
    const store = guardReads(raw, userSubject("ria", "reader"), inProcessPdp);
    assert.equal((await store.getPage("members"))?.title, "Members only");
    assert.equal((await store.listItems("planning-item")).length, 1);
    assert.equal((await store.listVersions("page", "members")).length, 1);
    assert.equal(typeof store.putItem, "function");
  });
});

describe("legacy wiki visibility", () => {
  it("maps members to restricted and public to public, and leaves access alone when present", () => {
    assert.deepEqual(legacyVisibilityToAccess({ visibility: "members", title: "t" }), { title: "t", access: "restricted" });
    assert.deepEqual(legacyVisibilityToAccess({ visibility: "public" }), { access: "public" });
    assert.deepEqual(legacyVisibilityToAccess({ visibility: "members", access: "public" }), { access: "public" });
    assert.equal(WikiSchema.parse({ slug: "help", title: "Help", visibility: "members" }).access, "restricted");
    assert.equal(WikiSchema.parse({ slug: "help", title: "Help" }).access, "public");
  });
});
