import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
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
  /** Members register with an address (design/communities.md §4.1); admin-made accounts may have none. */
  email: varchar("email", { length: 255 }).unique(),
  emailVerifiedAt: ts("email_verified_at"),
  /** The mail digest of notifications: "daily" | "off" — see db-schema.ts. */
  digest: varchar("digest", { length: 16 }).notNull().default("daily"),
});

/** One-time e-mail tokens (verify an address, reset a password) — see db-schema.ts. */
export const emailTokens = pgTable(
  "email_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 16 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    createdAt: ts("created_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("idx_email_tokens_user").on(t.userName)]
);

/** Group membership (design/communities.md §4.1–4.2) — see db-schema.ts. */
export const memberships = pgTable(
  "memberships",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    groupSlug: varchar("group_slug", { length: 128 }).notNull(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    role: varchar("role", { length: 16 }).notNull().default("member"),
    status: varchar("status", { length: 16 }).notNull().default("requested"),
    createdAt: ts("created_at").notNull(),
    decidedAt: ts("decided_at"),
    decidedBy: varchar("decided_by", { length: 64 }),
  },
  (t) => [uniqueIndex("uq_memberships").on(t.groupSlug, t.userName), index("idx_memberships_user").on(t.userName)]
);

/** Invitation links to a group — see db-schema.ts. */
export const invites = pgTable(
  "invites",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    groupSlug: varchar("group_slug", { length: 128 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    role: varchar("role", { length: 16 }).notNull().default("member"),
    createdBy: varchar("created_by", { length: 64 }).notNull(),
    createdAt: ts("created_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
    uses: integer("uses").notNull().default(0),
  },
  (t) => [index("idx_invites_group").on(t.groupSlug)]
);

/** Sign-ups for events (design/communities.md §4.5) — see db-schema.ts. */
export const attendances = pgTable(
  "attendances",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventSlug: varchar("event_slug", { length: 128 }).notNull(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    consentAt: ts("consent_at").notNull(),
  },
  (t) => [uniqueIndex("uq_attendances").on(t.eventSlug, t.userName), index("idx_attendances_user").on(t.userName)]
);

/** Site search as statistics — see db-schema.ts. */
export const searchLog = pgTable(
  "search_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    query: varchar("query", { length: 200 }).notNull(),
    hits: integer("hits").notNull(),
    automated: integer("automated").notNull().default(0),
    at: ts("at").notNull(),
  },
  (t) => [index("idx_search_log_at").on(t.at)]
);

/** Notifications — see db-schema.ts. */
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    href: varchar("href", { length: 512 }).notNull(),
    actor: varchar("actor", { length: 64 }),
    createdAt: ts("created_at").notNull(),
    readAt: ts("read_at"),
    mailedAt: ts("mailed_at"),
  },
  (t) => [index("idx_notifications_user").on(t.userName, t.createdAt)]
);

/** Personal API tokens — see db-schema.ts. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    scopes: varchar("scopes", { length: 255 }).notNull(),
    createdAt: ts("created_at").notNull(),
    expiresAt: ts("expires_at"),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("idx_tokens_user").on(t.userName)]
);
