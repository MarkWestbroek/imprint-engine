import {
  bigserial,
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Postgres twin of db-schema.ts — same bitemporal-light tables (§B3), same
 * column names, so a backup of one dialect maps 1:1 onto the other. Kept as
 * a separate file because drizzle's table builders are per dialect; the
 * *behaviour* is shared in db-store-base.ts.
 *
 * Differences that matter:
 *  - `data` is real `jsonb` (MariaDB: JSON = LONGTEXT, parsed by hand);
 *  - timestamps carry a time zone (`timestamptz(3)`), so an as-of moment
 *    means the same instant regardless of the server's locale;
 *  - `tstzrange` + exclusion constraints (true bitemporal) can be added here
 *    later without touching the MySQL schema.
 */
const ts = (name: string) => timestamp(name, { withTimezone: true, precision: 3, mode: "date" });

export const contentItems = pgTable(
  "content_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: varchar("type", { length: 32 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    lang: varchar("lang", { length: 8 }).notNull().default("en"),
    /** The zod-validated payload (shape depends on `type`). */
    data: jsonb("data").notNull(),
    validFrom: ts("valid_from").notNull(),
    /** NULL = valid forever. */
    validTo: ts("valid_to"),
    txFrom: ts("tx_from").notNull(),
    /** NULL = current assertion; set when superseded or deleted. */
    txTo: ts("tx_to"),
    createdBy: varchar("created_by", { length: 64 }),
  },
  (t) => [
    index("idx_current").on(t.type, t.slug, t.lang, t.txTo),
    index("idx_type").on(t.type, t.txTo),
  ]
);

/** UML: User (name, hashedPassword, role: RoleType). Auth for /admin. */
export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  /** Format: scrypt:<salt-hex>:<hash-hex> (see the site's auth lib). */
  hashedPassword: varchar("hashed_password", { length: 255 }).notNull(),
  /** "admin" | "editor" | "reader" (RoleType). */
  role: varchar("role", { length: 16 }).notNull().default("reader"),
});
