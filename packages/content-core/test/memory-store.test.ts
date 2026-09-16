import { before, describe } from "node:test";

import { createMemoryDb, MemoryContentStore } from "../src/memory-store";
import type { WidgetTypeRegistry } from "../src/widgets";
import { seedFixtures } from "./db-test-helpers";
import { contentStoreContract } from "./store-contract";
import { writableStoreContract } from "./writable-contract";

/**
 * The in-memory backend runs exactly the suites the database backends run.
 * That is what licenses using it as a stand-in for a database elsewhere
 * (the renderer characterisation in sites/musicbrain): same contract, proven.
 * Needs no database, so it always runs.
 */
describe("MemoryContentStore (in-memory)", () => {
  const db = createMemoryDb();
  before(async () => {
    await seedFixtures(new MemoryContentStore(db));
  });

  const factory = async (opts?: { widgets?: WidgetTypeRegistry }) => new MemoryContentStore(db, opts);
  contentStoreContract("MemoryContentStore", factory);
  writableStoreContract("MemoryContentStore", factory);
});
