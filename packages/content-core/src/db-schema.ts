import {
  bigint,
  datetime,
  index,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Bitemporal-light tables (§B3): every content mutation is a new row.
 *
 *  - valid time  (valid_from/valid_to): when the content is/was *true* —
 *    scheduled publishing (S6) and "site as of date X" (S5) fall out for free.
 *  - transaction time (tx_from/tx_to): when we *asserted* it — full version
 *    history and rollback (S4). The current assertion has tx_to = NULL.
 *
 * One generic table for all content types: the zod schemas in schemas.ts
 * remain the source of truth for what `data` looks like per type, so the
 * database stays dumb and migrates cleanly to the real bitemporal register.
 */
export const contentItems = mysqlTable(
  "content_items",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    /** "site" | "product" | "release" | "page" | "menu" */
    type: varchar("type", { length: 32 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    lang: varchar("lang", { length: 8 }).notNull().default("en"),
    /** The zod-validated payload (shape depends on `type`). */
    data: json("data").notNull(),
    validFrom: datetime("valid_from", { fsp: 3 }).notNull(),
    /** NULL = valid forever. */
    validTo: datetime("valid_to", { fsp: 3 }),
    txFrom: datetime("tx_from", { fsp: 3 }).notNull(),
    /** NULL = current assertion; set when superseded or deleted. */
    txTo: datetime("tx_to", { fsp: 3 }),
    createdBy: varchar("created_by", { length: 64 }),
  },
  (t) => [
    index("idx_current").on(t.type, t.slug, t.lang, t.txTo),
    index("idx_type").on(t.type, t.txTo),
  ]
);

/** UML: User (name, hashedPassword, role: RoleType). Auth for /admin. */
export const users = mysqlTable("users", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  /** Format: scrypt:<salt-hex>:<hash-hex> (see the site's auth lib). */
  hashedPassword: varchar("hashed_password", { length: 255 }).notNull(),
  /** "admin" | "editor" | "reader" (RoleType). */
  role: varchar("role", { length: 16 }).notNull().default("reader"),
});
