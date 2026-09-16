import { createDb, DbContentStore } from "./db-store";
import { createPgDb, PgContentStore } from "./db-store.pg";
import { DbUserStore } from "./user-store";
import type { WritableContentStore } from "./store";
import type { WidgetTypeRegistry } from "./widgets";

/**
 * Backend selection by connection URL — the one place that knows more than
 * one database dialect exists (architecture.md §0 rule 3: only a site's
 * composition root instantiates a backend, and it does so through here).
 *
 *   mysql://…  | mariadb://…      → DbContentStore  (MariaDB/MySQL, drizzle/mysql2)
 *   postgres://… | postgresql://… → PgContentStore  (Postgres, drizzle/node-postgres)
 */
export type Dialect = "mysql" | "postgres";

export function dialectOf(url: string): Dialect {
  const scheme = url.split(":", 1)[0].toLowerCase();
  if (scheme === "mysql" || scheme === "mariadb") return "mysql";
  if (scheme === "postgres" || scheme === "postgresql") return "postgres";
  throw new Error(`DATABASE_URL: unsupported scheme "${scheme}" (use mysql:// or postgres://)`);
}

export type OpenedContentDatabase = {
  dialect: Dialect;
  store: WritableContentStore;
  /** Users/roles for admin login. MariaDB only for now (backlog: Postgres twin). */
  users: DbUserStore | null;
  /** Release the connection pool (CLI scripts; a long-running site never calls this). */
  close(): Promise<void>;
};

export function openContentDatabase(
  url: string,
  opts: { widgets?: WidgetTypeRegistry } = {}
): OpenedContentDatabase {
  const dialect = dialectOf(url);
  if (dialect === "postgres") {
    const db = createPgDb(url);
    return { dialect, store: new PgContentStore(db, opts), users: null, close: () => db.$client.end() };
  }
  const db = createDb(url);
  return {
    dialect,
    store: new DbContentStore(db, opts),
    users: new DbUserStore(db),
    close: () => db.$client.end(),
  };
}
