import { after, before, describe } from "node:test";
import { sql } from "drizzle-orm";

import { createDb, DbContentStore, type Db } from "../src/db-store";
import { DbUserStore } from "../src/user-store";
import type { WidgetTypeRegistry } from "../src/widgets";
import { migrationStatements, seedFixtures, testDatabaseUrl } from "./db-test-helpers";
import { contentStoreContract } from "./store-contract";
import { userStoreContract } from "./user-store-contract";
import { writableStoreContract } from "./writable-contract";

/**
 * Characterisation of the MariaDB backend (v1, bitemporal-light §B3):
 * the read contract plus the write contract, against a throwaway database.
 *
 * Needs TEST_DATABASE_URL (see .env.example / `npm run test:db`); without it
 * this file is skipped, so `npm test` stays green on a bare checkout and in
 * CI. The tables are dropped and recreated from the real migrations in
 * drizzle/ — the same ones production runs.
 */
const url = testDatabaseUrl("TEST_DATABASE_URL");

describe("DbContentStore (MariaDB)", { skip: url ? false : "TEST_DATABASE_URL not set" }, () => {
  let db: Db;
  before(async () => {
    db = createDb(url!);
    await db.execute(sql`DROP TABLE IF EXISTS content_items`);
    await db.execute(sql`DROP TABLE IF EXISTS users`);
    await db.execute(sql`DROP TABLE IF EXISTS api_tokens`);
    // The members' tables (design/communities.md G1, §4.5): every table a migration creates, so a re-run starts clean.
    for (const table of ["email_tokens", "memberships", "invites", "attendances", "notifications"]) {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table}`));
    }
    for (const statement of await migrationStatements("drizzle")) await db.execute(sql.raw(statement));
    await seedFixtures(new DbContentStore(db));
  });
  after(async () => {
    await db.$client.end();
  });

  const factory = async (opts?: { widgets?: WidgetTypeRegistry }) => new DbContentStore(db, opts);
  contentStoreContract("DbContentStore", factory);
  writableStoreContract("DbContentStore", factory);
  userStoreContract("DbUserStore", async () => new DbUserStore(db));
});
