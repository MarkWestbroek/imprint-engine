import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { UserStore } from "../src/user-store-base";

/**
 * What every users backend must do — run by the MariaDB and the Postgres
 * suites alike, like the content-store contracts. Expects an empty `users`
 * table; the cases build on each other, in order.
 */
const PASSWORD = "correct horse battery";

export function userStoreContract(name: string, factory: () => Promise<UserStore>): void {
  describe(`${name}: user-store contract`, () => {
    it("creates users and lists them by name, without the hash", async () => {
      const users = await factory();
      assert.deepEqual(await users.list(), []);
      await users.create("mark", PASSWORD, "admin");
      const ed = await users.create("ed", PASSWORD, "editor");
      assert.equal(ed.role, "editor");
      const all = await users.list();
      assert.deepEqual(all.map((u) => u.name), ["ed", "mark"]);
      assert.deepEqual(Object.keys(all[0]).sort(), ["email", "emailVerified", "id", "name", "role"]);
      assert.deepEqual([all[0].email, all[0].emailVerified], [null, false], "admin-made accounts have no address");
    });

    it("refuses duplicates, bad names and weak passwords", async () => {
      const users = await factory();
      await assert.rejects(users.create("mark", PASSWORD, "reader"), /already exists/);
      await assert.rejects(users.create("no spaces", PASSWORD, "reader"), /Username must be/);
      await assert.rejects(users.create("weak", "short", "reader"), /at least/);
    });

    it("verifies credentials", async () => {
      const users = await factory();
      assert.equal((await users.verify("mark", PASSWORD))?.role, "admin");
      assert.equal(await users.verify("mark", "wrong password!!"), null);
      assert.equal(await users.verify("nobody", PASSWORD), null);
    });

    it("changes a password only with the current one", async () => {
      const users = await factory();
      const next = "another long password";
      await assert.rejects(users.changePassword("ed", "not the current", next), /Current password/);
      await users.changePassword("ed", PASSWORD, next);
      assert.equal(await users.verify("ed", PASSWORD), null);
      assert.ok(await users.verify("ed", next));
    });

    it("guards the last admin against demotion and removal", async () => {
      const users = await factory();
      await assert.rejects(users.setRole("mark", "editor"), /only admin/);
      await assert.rejects(users.remove("mark"), /only admin/);
      await users.setRole("ed", "admin");
      await users.setRole("mark", "reader");
      assert.equal((await users.get("mark"))?.role, "reader");
    });

    it("API tokens: shown once, stored as a hash, act as their user with the current role", async () => {
      const users = await factory();
      const { token, record } = await users.createToken("ed", "patch editor", ["media:upload"]);
      assert.match(token, /^imp_[A-Za-z0-9_-]{40,}$/);
      assert.equal(record.prefix, token.slice(0, 12));
      assert.equal("hash" in record, false);
      assert.deepEqual(record.scopes, ["media:upload"]);

      const grant = await users.authenticate(token);
      assert.equal(grant?.user.name, "ed");
      assert.equal(grant?.user.role, "admin", "the role ed has now, not when the token was made");
      assert.deepEqual(grant?.scopes, ["media:upload"]);
      assert.ok((await users.tokens("ed"))[0].lastUsedAt, "use is recorded");

      assert.equal(await users.authenticate(token.slice(0, -1) + "x"), null);
      assert.equal(await users.authenticate("Bearer nonsense"), null);
      await assert.rejects(users.createToken("ed", "none", []), /at least one scope/);
    });

    it("API tokens: revoked and expired ones no longer hold; a user revokes only their own", async () => {
      const users = await factory();
      const past = new Date(Date.now() - 1000);
      const expired = await users.createToken("ed", "old", ["media:read"], { expiresAt: past });
      assert.equal(await users.authenticate(expired.token), null);
      const live = await users.createToken("ed", "live", ["media:read", "media:upload"]);
      await assert.rejects(users.revokeToken("mark", live.record.id), /No such token/);
      await users.revokeToken("ed", live.record.id);
      assert.equal(await users.authenticate(live.token), null);
      const list = await users.tokens("ed");
      assert.deepEqual(list.map((t) => [t.name, t.active]), [["live", false], ["old", false], ["patch editor", true]]);
    });

    it("members register with an e-mail address, unverified, as reader; sign in by name or address", async () => {
      const users = await factory();
      const ann = await users.register("ann", "Ann@Example.org ", PASSWORD);
      assert.deepEqual([ann.role, ann.email, ann.emailVerified], ["reader", "ann@example.org", false]);
      assert.equal((await users.verify("ann@example.org", PASSWORD))?.name, "ann");
      assert.equal((await users.getByEmail("ANN@example.org"))?.name, "ann");
      await assert.rejects(users.register("ann2", "ann@example.org", PASSWORD), /already registered/);
      await assert.rejects(users.register("ann3", "not-an-address", PASSWORD), /not an e-mail/);
      await assert.rejects(users.setEmail("ed", "ann@example.org"), /already registered/);
    });

    it("e-mail tokens: one use, one purpose, an expiry; verifying marks the address", async () => {
      const users = await factory();
      const token = await users.createEmailToken("ann", "verify");
      assert.equal(await users.consumeEmailToken(token, "reset"), null, "another purpose");
      assert.equal(await users.consumeEmailToken("nonsense", "verify"), null);
      const verified = await users.consumeEmailToken(token, "verify");
      assert.equal(verified?.emailVerified, true);
      assert.equal(await users.consumeEmailToken(token, "verify"), null, "used before");
      const stale = await users.createEmailToken("ann", "reset", 1, new Date(Date.now() - 2 * 3600_000));
      assert.equal(await users.consumeEmailToken(stale, "reset"), null, "expired");
    });

    it("memberships: request, approve, roles, leave; a user's memberships go with the user", async () => {
      const users = await factory();
      assert.deepEqual(await users.membersOf("atlas"), []);
      const asked = await users.join("atlas", "ann", { status: "requested" });
      assert.deepEqual([asked.role, asked.status, asked.decidedBy], ["member", "requested", null]);
      await assert.rejects(users.join("atlas", "nobody", { status: "active" }), /No such user/);
      const approved = await users.setMembership("atlas", "ann", { status: "active" }, "ed");
      assert.deepEqual([approved.status, approved.decidedBy], ["active", "ed"]);
      await users.join("atlas", "ann", { status: "requested" });
      assert.equal((await users.membership("atlas", "ann"))?.status, "active", "an active membership stays");
      await users.setMembership("atlas", "ann", { role: "manager" }, "ed");
      assert.equal((await users.membership("atlas", "ann"))?.role, "manager");
      await users.join("signalen", "ann", { status: "active" });
      assert.deepEqual((await users.membershipsOf("ann")).map((m) => m.groupSlug), ["atlas", "signalen"]);
      await users.leave("signalen", "ann");
      await users.leave("signalen", "ann"); // gone already: no error
      assert.deepEqual((await users.membershipsOf("ann")).map((m) => m.groupSlug), ["atlas"]);
      await assert.rejects(users.setMembership("signalen", "ann", { status: "active" }, "ed"), /no member/);
    });

    it("invites: a code joins with the invite's role, until it expires or is revoked", async () => {
      const users = await factory();
      const code = await users.createInvite("signalen", "manager", "ed", 30);
      assert.equal(await users.redeemInvite("wrong-code", "ann"), null);
      const joined = await users.redeemInvite(code, "ann");
      assert.deepEqual([joined?.groupSlug, joined?.role, joined?.status, joined?.decidedBy], ["signalen", "manager", "active", "ed"]);
      const [invite] = await users.invitesOf("signalen");
      assert.deepEqual([invite.uses, invite.active, "hash" in invite], [1, true, false]);
      await users.revokeInvite("signalen", invite.id);
      assert.equal(await users.redeemInvite(code, "ed"), null, "revoked");
      assert.equal((await users.invitesOf("signalen"))[0].active, false);
    });

    it("removes users; unknown names are an error", async () => {
      const users = await factory();
      await users.remove("mark");
      assert.equal(await users.get("mark"), null);
      await users.remove("ed").catch(() => {}); // ed is the only admin now: refused, and that's fine
      assert.ok((await users.tokens("ed")).length > 0, "a user's tokens go only with the user");
      await users.remove("ann");
      assert.deepEqual(await users.membersOf("atlas"), [], "memberships go with the user");
      await assert.rejects(users.remove("mark"), /No such user/);
      await assert.rejects(users.setPassword("mark", PASSWORD), /No such user/);
    });
  });
}
