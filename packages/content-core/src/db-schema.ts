import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  uniqueIndex,
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
  /** Members register with an address (design/communities.md §4.1); admin-made accounts may have none. */
  email: varchar("email", { length: 255 }).unique(),
  emailVerifiedAt: datetime("email_verified_at", { fsp: 3 }),
});

/**
 * One-time e-mail tokens: verifying an address, resetting a password. Only
 * a SHA-256 of the token is stored; `purpose` keeps a verify token from
 * doubling as a reset.
 */
export const emailTokens = mysqlTable(
  "email_tokens",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 16 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
    usedAt: datetime("used_at", { fsp: 3 }),
  },
  (t) => [index("idx_email_tokens_user").on(t.userName)]
);

/**
 * Group membership (design/communities.md §4.1–4.2): personal data, so a
 * table of its own and not content. `role` owner | manager | member;
 * `status` requested | active. The group itself is content (plugin-groups).
 */
export const memberships = mysqlTable(
  "memberships",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    groupSlug: varchar("group_slug", { length: 128 }).notNull(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    role: varchar("role", { length: 16 }).notNull().default("member"),
    status: varchar("status", { length: 16 }).notNull().default("requested"),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    decidedAt: datetime("decided_at", { fsp: 3 }),
    decidedBy: varchar("decided_by", { length: 64 }),
  },
  (t) => [uniqueIndex("uq_memberships").on(t.groupSlug, t.userName), index("idx_memberships_user").on(t.userName)]
);

/**
 * Invitation links to a group (design/communities.md §4.1a): whoever opens
 * one and signs in joins with `role`, no approval needed. Only a hash of the
 * code is stored.
 */
export const invites = mysqlTable(
  "invites",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    groupSlug: varchar("group_slug", { length: 128 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    role: varchar("role", { length: 16 }).notNull().default("member"),
    createdBy: varchar("created_by", { length: 64 }).notNull(),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
    uses: int("uses").notNull().default(0),
  },
  (t) => [index("idx_invites_group").on(t.groupSlug)]
);

/**
 * Sign-ups for events (design/communities.md §4.5): who comes, maybe comes
 * or does not come. Personal data: a table, not content. `consent_at` is
 * when the member agreed that the organiser may see name and address.
 */
export const attendances = mysqlTable(
  "attendances",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    eventSlug: varchar("event_slug", { length: 128 }).notNull(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { fsp: 3 }).notNull(),
    consentAt: datetime("consent_at", { fsp: 3 }).notNull(),
  },
  (t) => [uniqueIndex("uq_attendances").on(t.eventSlug, t.userName), index("idx_attendances_user").on(t.userName)]
);

/**
 * Notifications (design/communities.md §4.4, G3c): what happened that a
 * member wants to know — a reply, a comment on your post, a changed passage
 * you annotated, a membership decision. Personal data in the user store, like
 * sign-ups: not content, no history; they go with the user. `read_at` is the
 * only thing that changes; the mail digest reads `mailed_at`.
 */
export const notifications = mysqlTable(
  "notifications",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    href: varchar("href", { length: 512 }).notNull(),
    actor: varchar("actor", { length: 64 }),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    readAt: datetime("read_at", { fsp: 3 }),
    mailedAt: datetime("mailed_at", { fsp: 3 }),
  },
  (t) => [index("idx_notifications_user").on(t.userName, t.createdAt)]
);

/**
 * Personal API tokens (design/beeldbibliotheek.md §12.4): a client outside the
 * admin (the patch editor) acts as its user, limited to the token's scopes.
 * Only a SHA-256 of the token is stored (tokens are long and random, so no
 * slow hash is needed); `prefix` is the first characters, to recognise it.
 * Like users: not content, no history.
 */
export const apiTokens = mysqlTable(
  "api_tokens",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userName: varchar("user_name", { length: 64 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    /** Comma-separated, e.g. "media:upload,media:read". */
    scopes: varchar("scopes", { length: 255 }).notNull(),
    createdAt: datetime("created_at", { fsp: 3 }).notNull(),
    expiresAt: datetime("expires_at", { fsp: 3 }),
    lastUsedAt: datetime("last_used_at", { fsp: 3 }),
    revokedAt: datetime("revoked_at", { fsp: 3 }),
  },
  (t) => [index("idx_tokens_user").on(t.userName)]
);
