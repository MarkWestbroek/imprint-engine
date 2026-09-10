import { after, before, describe } from "node:test";
import { sql } from "drizzle-orm";

import { createPgDb, PgContentStore, type PgDb } from "../src/db-store.pg";
import type { WidgetTypeRegistry } from "../src/widgets";
import { migrationStatements, seedFixtures, testDatabaseUrl } from "./db-test-helpers";
import { contentStoreContract } from "./store-contract";
import { writableStoreContract } from "./writable-contract";

/**
 * The Postgres backend runs exactly the suites the MariaDB backend runs —
 * that is the whole point (architecture.md §0 rule 3): a backend is one
 * implementation of the contract, proven by the same tests.
 *
 * Needs TEST_PG_DATABASE_URL (see .env.example / `npm run test:db`); skipped
 * otherwise. Tables come from the real migrations in drizzle-pg/.
 */
const url = testDatabaseUrl("TEST_PG_DATABASE_URL");

describe("PgContentStore (Postgres)", { skip: url ? false : "TEST_PG_DATABASE_URL not set" }, () => {
  let db: PgDb;
  before(async () => {
    db = createPgDb(url!);
    await db.execute(sql`DROP TABLE IF EXISTS content_items`);
    await db.execute(sql`DROP TABLE IF EXISTS users`);
    for (const statement of await migrationStatements("drizzle-pg")) await db.execute(sql.raw(statement));
    await seedFixtures(new PgContentStore(db));
  });
  after(async () => {
    await db.$client.end();
  });

  const factory = async (opts?: { widgets?: WidgetTypeRegistry }) => new PgContentStore(db, opts);
  contentStoreContract("PgContentStore", factory);
  writableStoreContract("PgContentStore", factory);
});
