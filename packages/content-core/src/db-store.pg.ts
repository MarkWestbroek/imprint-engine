import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import { contentItems, users } from "./db-schema.pg";
import { DbContentStoreBase, type ContentRow, type NewContentRow, type StoreOptions } from "./db-store-base";
import type { WidgetTypeRegistry } from "./widgets";
import type { ContentType } from "./store";

export type PgDb = NodePgDatabase & { $client: pg.Pool };

/** One pool per process; Next.js dev reloads modules, so keep it lazy. */
export function createPgDb(url: string): PgDb {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return drizzle(pool) as PgDb;
}

export { contentItems, users };

/**
 * Postgres backend — the second database backend behind the same
 * ContentStore contract (architecture.md §0). Same six row operations as
 * the MariaDB store, in the pg dialect; `jsonb` comes back parsed, so no
 * thaw step. Everything observable is inherited from DbContentStoreBase and
 * proven equal by the shared contract suite.
 */
export class PgContentStore extends DbContentStoreBase {
  constructor(
    private readonly db: PgDb,
    opts: StoreOptions = {}
  ) {
    super(opts);
  }

  protected async selectValidAt(type: ContentType, asOf: Date): Promise<ContentRow[]> {
    return this.db
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
  }

  protected async selectCurrent(type: ContentType): Promise<ContentRow[]> {
    return this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.type, type), isNull(contentItems.txTo)))
      .orderBy(contentItems.slug, contentItems.lang);
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
    return rows[0] ?? null;
  }

  protected async selectVersions(type: ContentType, slug: string, lang: string): Promise<ContentRow[]> {
    return this.db
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
