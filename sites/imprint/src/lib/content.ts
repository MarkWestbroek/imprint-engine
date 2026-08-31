import path from "node:path";
import { FileContentStore, type ContentStore } from "@imprint/content-core";
import { createDb, DbContentStore, type Db } from "@imprint/content-core/db-store";

const url = process.env.DATABASE_URL;
const globalForDb = globalThis as unknown as { __imprintProductDb?: Db };

export const db: Db | null = url
  ? (globalForDb.__imprintProductDb ??= createDb(url))
  : null;

export const store: ContentStore = db
  ? new DbContentStore(db)
  : new FileContentStore(path.join(process.cwd(), "content"));
