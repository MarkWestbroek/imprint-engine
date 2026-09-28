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
      assert.deepEqual(Object.keys(all[0]).sort(), ["id", "name", "role"]);
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

    it("removes users; unknown names are an error", async () => {
      const users = await factory();
      await users.remove("mark");
      assert.equal(await users.get("mark"), null);
      await users.remove("ed").catch(() => {}); // ed is the only admin now: refused, and that's fine
      assert.ok((await users.tokens("ed")).length > 0, "a user's tokens go only with the user");
      await assert.rejects(users.remove("mark"), /No such user/);
      await assert.rejects(users.setPassword("mark", PASSWORD), /No such user/);
    });
  });
}
