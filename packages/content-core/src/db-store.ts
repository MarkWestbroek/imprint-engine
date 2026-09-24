import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { contentItems, users } from "./db-schema";
import { DbContentStoreBase, type ContentRow, type NewContentRow, type StoreOptions } from "./db-store-base";
import type { WidgetTypeRegistry } from "./widgets";
import type { ContentType } from "./store";

export type Db = MySql2Database & { $client: mysql.Pool };

/** One pool per process; Next.js dev reloads modules, so keep it lazy. */
export function createDb(url: string): Db {
  const pool = mysql.createPool({ uri: url, connectionLimit: 5 });
  return drizzle(pool) as Db;
}

export { contentItems, users };

/**
 * MariaDB/MySQL backend (v1). All read/write semantics live in
 * DbContentStoreBase; this class is only the six row operations in the
 * MySQL dialect. Its Postgres twin is db-store.pg.ts.
 */
export class DbContentStore extends DbContentStoreBase {
  constructor(
    private readonly db: Db,
    opts: StoreOptions = {}
  ) {
    super(opts);
  }

  /**
   * MariaDB's JSON type is an alias for LONGTEXT, so mysql2 hands the payload
   * back as a string (real MySQL parses it). Normalize on every read.
   */
  private static thaw(row: typeof contentItems.$inferSelect): ContentRow {
    return typeof row.data === "string" ? { ...row, data: JSON.parse(row.data) } : row;
  }

  protected async selectValidAt(type: ContentType, asOf: Date): Promise<ContentRow[]> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.type, type),
          lte(contentItems.txFrom, asOf),
          or(isNull(contentItems.txTo), gt(contentItems.txTo, asOf)),
          lte(contentItems.validFrom, asOf),
          or(isNull(contentItems.validTo), gt(contentItems.validTo, asOf))
        )
      );
    return rows.map(DbContentStore.thaw);
  }

  protected async selectCurrent(type: ContentType): Promise<ContentRow[]> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.type, type), isNull(contentItems.txTo)))
      .orderBy(contentItems.slug, contentItems.lang);
    return rows.map(DbContentStore.thaw);
  }

  protected async selectCurrentOne(type: ContentType, slug: string, lang: string): Promise<ContentRow | null> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.type, type),
          eq(contentItems.slug, slug),
          eq(contentItems.lang, lang),
          isNull(contentItems.txTo)
        )
      )
      .limit(1);
    return rows[0] ? DbContentStore.thaw(rows[0]) : null;
  }

  protected async selectVersions(type: ContentType, slug: string, lang: string): Promise<ContentRow[]> {
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.type, type),
          eq(contentItems.slug, slug),
          eq(contentItems.lang, lang)
        )
      )
      .orderBy(desc(contentItems.txFrom));
    return rows.map(DbContentStore.thaw);
  }

  protected async supersede(
    type: ContentType,
    slug: string,
    lang: string,
    at: Date,
    next: NewContentRow | null
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(contentItems)
        .set({ txTo: at })
        .where(
          and(
            eq(contentItems.type, type),
            eq(contentItems.slug, slug),
            eq(contentItems.lang, lang),
            isNull(contentItems.txTo)
          )
        );
      if (next) await tx.insert(contentItems).values(next);
    });
  }
}
