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

    it("removes users; unknown names are an error", async () => {
      const users = await factory();
      await users.remove("mark");
      assert.equal(await users.get("mark"), null);
      await assert.rejects(users.remove("mark"), /No such user/);
      await assert.rejects(users.setPassword("mark", PASSWORD), /No such user/);
    });
  });
}
