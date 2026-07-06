import path from "node:path";
import {
  FileContentStore,
  type ContentStore,
  type WritableContentStore,
} from "@imprint/content-core";
import { createDb, DbContentStore, type Db } from "@imprint/content-core/db-store";
import { widgetRegistry } from "@/widgets/registry";

/**
 * The one place the site talks to content (S1). With DATABASE_URL set the
 * site runs on the bitemporal-light database (v1); without it, it falls back
 * to the file-backed store (v0) — so a checkout still builds with no DB.
 */

const url = process.env.DATABASE_URL;

// Dev hot-reload re-evaluates modules; keep one connection pool per process.
const globalForDb = globalThis as unknown as { __imprintDb?: Db };
export const db: Db | null = url ? (globalForDb.__imprintDb ??= createDb(url)) : null;

export const store: ContentStore = db
  ? new DbContentStore(db, { widgets: widgetRegistry })
  : new FileContentStore(path.join(process.cwd(), "content"), {
      widgets: widgetRegistry,
    });

/** Write access for /admin. Null in file mode: v0 content is edited in git. */
export const writableStore: WritableContentStore | null = db
  ? (store as DbContentStore)
  : null;
