import { DbContentStoreBase, type ContentRow, type NewContentRow, type StoreOptions } from "./db-store-base";
import type { ContentType } from "./store";
import type { WidgetTypeRegistry } from "./widgets";

/**
 * The "database" of the in-memory backend: a row array plus an id sequence.
 * Several stores can share one (e.g. with different widget registries), just
 * like several DbContentStores share one connection pool.
 */
export type MemoryDb = { rows: ContentRow[]; nextId: number };

export function createMemoryDb(): MemoryDb {
  return { rows: [], nextId: 1 };
}

const sameItem = (row: ContentRow, type: string, slug: string, lang: string) =>
  row.type === type && row.slug === slug && row.lang === lang;

/**
 * In-memory backend (architecture.md §4): the bitemporal-light semantics of
 * the database stores — it inherits DbContentStoreBase and passes the same
 * read and write contract suites — with rows in an array instead of a table.
 *
 * For tests, previews and demos that need the write side without a database
 * (the renderer characterisation uses it as the site's store). Not persistent
 * and not shared between processes; never a production backend.
 *
 * Rows are copied on the way in (JSON round-trip, like a database column)
 * and on the way out, so callers can't mutate stored history.
 */
export class MemoryContentStore extends DbContentStoreBase {
  constructor(
    private readonly db: MemoryDb,
    opts: StoreOptions = {}
  ) {
    super(opts);
  }

  private static copy(row: ContentRow): ContentRow {
    return {
      ...row,
      data: structuredClone(row.data),
      validFrom: new Date(row.validFrom),
      validTo: row.validTo && new Date(row.validTo),
      txFrom: new Date(row.txFrom),
      txTo: row.txTo && new Date(row.txTo),
    };
  }

  protected async selectValidAt(type: ContentType, asOf: Date): Promise<ContentRow[]> {
    const t = asOf.getTime();
    return this.db.rows
      .filter(
        (r) =>
          r.type === type &&
          r.txFrom.getTime() <= t &&
          (r.txTo === null || r.txTo.getTime() > t) &&
          r.validFrom.getTime() <= t &&
          (r.validTo === null || r.validTo.getTime() > t)
      )
      .map(MemoryContentStore.copy);
  }

  protected async selectCurrent(type: ContentType): Promise<ContentRow[]> {
    const byKey = (a: ContentRow, b: ContentRow) =>
      a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0;
    return this.db.rows
      .filter((r) => r.type === type && r.txTo === null)
      .sort(byKey)
      .map(MemoryContentStore.copy);
  }

  protected async selectCurrentOne(type: ContentType, slug: string, lang: string): Promise<ContentRow | null> {
    const row = this.db.rows.find((r) => sameItem(r, type, slug, lang) && r.txTo === null);
    return row ? MemoryContentStore.copy(row) : null;
  }

  protected async selectVersions(type: ContentType, slug: string, lang: string): Promise<ContentRow[]> {
    return this.db.rows
      .filter((r) => sameItem(r, type, slug, lang))
      // Newest assertion first; equal timestamps: the later insert is newer.
      .sort((a, b) => b.txFrom.getTime() - a.txFrom.getTime() || b.id - a.id)
      .map(MemoryContentStore.copy);
  }

  protected async supersede(
    type: ContentType,
    slug: string,
    lang: string,
    at: Date,
    next: NewContentRow | null
  ): Promise<void> {
    const current = this.db.rows.find((r) => sameItem(r, type, slug, lang) && r.txTo === null);
    if (current) current.txTo = new Date(at);
    if (next) {
      this.db.rows.push({
        ...next,
        id: this.db.nextId++,
        data: JSON.parse(JSON.stringify(next.data)),
        validFrom: new Date(next.validFrom),
        validTo: next.validTo && new Date(next.validTo),
        txFrom: new Date(next.txFrom),
        txTo: next.txTo && new Date(next.txTo),
      });
    }
  }
}
