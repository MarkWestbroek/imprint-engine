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

describe("inProcessPdp: group content (design/communities.md §4.2)", () => {
  const forAtlas = (id: string) => ({ type: "page", id, properties: { access: "group:atlas" } });
  const read = { name: "read" };
  it("a group's members read its content; other members, readers and visitors do not; staff always does", async () => {
    const member = userSubject("ann", "reader", ["atlas", "signalen"]);
    const other = userSubject("bob", "reader", ["signalen"]);
    assert.equal((await inProcessPdp.evaluate({ subject: member, action: read, resource: forAtlas("x") })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: other, action: read, resource: forAtlas("x") })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: userSubject("ria", "reader"), action: read, resource: forAtlas("x") })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: ANONYMOUS, action: read, resource: forAtlas("x") })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: userSubject("ed", "editor"), action: read, resource: forAtlas("x") })).decision, true);
  });
  it("permit and permitted treat group content as non-public; a member keeps it in a list", async () => {
    const member = userSubject("ann", "reader", ["atlas"]);
    assert.equal(await permit(inProcessPdp, ANONYMOUS, "read", forAtlas("x")), false);
    assert.equal(await permit(inProcessPdp, member, "read", forAtlas("x")), true);
    const items = [{ slug: "a", access: "public" }, { slug: "b", access: "group:atlas" }, { slug: "c", access: "group:signalen" }];
    assert.deepEqual((await permitted(inProcessPdp, member, "page", items, (i) => i.slug)).map((i) => i.slug), ["a", "b"]);
    assert.deepEqual((await permitted(inProcessPdp, ANONYMOUS, "page", items, (i) => i.slug)).map((i) => i.slug), ["a"]);
  });
});

describe("inProcessPdp: members write in their groups (G3a)", () => {
  const post = (props: Record<string, unknown>) => ({ type: "post", id: "p", properties: { access: "public", ...props } });
  const inAtlas = post({ group: "atlas", author: "ann" });
  it("a member creates in their group as themselves, not elsewhere; a visitor never", async () => {
    const ann = userSubject("ann", "reader", ["atlas"]);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "create" }, resource: inAtlas })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "create" }, resource: post({ group: "signalen" }) })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "create" }, resource: post({ group: "" }) })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: ANONYMOUS, action: { name: "create" }, resource: inAtlas })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "create" }, resource: post({ group: "atlas", author: "bob" }) })).decision, false, "only as yourself");
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "create" }, resource: { type: "event", id: "x", properties: { group: "atlas", author: "ann" } } })).decision, true, "any type a plugin offers, same rule");
  });
  it("own posts may be changed and removed; a manager removes any post in the group", async () => {
    const ann = userSubject("ann", "reader", ["atlas"]);
    const bob = userSubject("bob", "reader", ["atlas"]);
    const boss = userSubject("boss", "reader", ["atlas"], ["atlas"]);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "update" }, resource: inAtlas })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "delete" }, resource: inAtlas })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: bob, action: { name: "delete" }, resource: inAtlas })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: boss, action: { name: "delete" }, resource: inAtlas })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: boss, action: { name: "update" }, resource: inAtlas })).decision, false, "removing, not rewriting someone's words");
  });
});

describe("inProcessPdp: annotating — on a readable item that allows it (design/annotaties.md)", () => {
  const anno = (on: Record<string, unknown>, author = "ann") => ({ type: "annotation", id: "a", properties: { access: "public", author, on } });
  const ann = userSubject("ann", "reader", ["atlas"]);
  const create = { name: "create" };
  it("a member annotates a public item that allows members; not one that is off, not one they may not read, not as someone else", async () => {
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: create, resource: anno({ access: "public", annotations: "members" }) })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: create, resource: anno({ access: "group:atlas", annotations: "members" }) })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: create, resource: anno({ access: "group:signalen", annotations: "members" }) })).decision, false, "not readable");
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: create, resource: anno({ access: "public", annotations: "off" }) })).decision, false, "switched off");
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: create, resource: anno({ access: "public", annotations: "members" }, "bob") })).decision, false, "only as yourself");
    assert.equal((await inProcessPdp.evaluate({ subject: ANONYMOUS, action: create, resource: anno({ access: "public", annotations: "members" }) })).decision, false, "a visitor has no account to annotate as");
  });
  it("own annotations stay editable and removable; staff may do anything", async () => {
    const own = { type: "annotation", id: "a", properties: { access: "public", author: "ann" } };
    assert.equal((await inProcessPdp.evaluate({ subject: ann, action: { name: "update" }, resource: own })).decision, true);
    assert.equal((await inProcessPdp.evaluate({ subject: userSubject("bob", "reader"), action: { name: "delete" }, resource: own })).decision, false);
    assert.equal((await inProcessPdp.evaluate({ subject: userSubject("ed", "editor"), action: { name: "delete" }, resource: own })).decision, true);
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
    await raw.putItem("component", "card", { slug: "card", name: "Card", access: "restricted" });
  });

  it("a visitor sees no restricted item in any list or get, nor through listItems/getItem", async () => {
    const store = guardReads(raw, ANONYMOUS, inProcessPdp);
    assert.equal((await store.listPages()).some((p) => p.slug === "members"), false);
    assert.equal(await store.getPage("members"), null);
    assert.equal((await store.listProducts()).some((p) => p.slug === "secret"), false);
    assert.equal(await store.getProduct("secret"), null);
    assert.equal((await store.listItems("component")).length, 0);
    assert.equal(await store.getItem("page", "members"), null);
    assert.ok(await store.getPage("about"), "public content is untouched");
    assert.ok((await store.listItems("page")).some((r) => r.slug === "about"));
  });

  it("a reader sees it all; the wrapper leaves writes and history alone", async () => {
    const store = guardReads(raw, userSubject("ria", "reader"), inProcessPdp);
    assert.equal((await store.getPage("members"))?.title, "Members only");
    assert.equal((await store.listItems("component")).length, 1);
    assert.equal((await store.listVersions("page", "members")).length, 1);
    assert.equal(typeof store.putItem, "function");
  });
});
