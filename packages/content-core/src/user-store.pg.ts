import { eq } from "drizzle-orm";

import { users } from "./db-schema.pg";
import { UserStore, type UserRow } from "./user-store-base";
import type { PgDb } from "./db-store.pg";

/** Postgres users — the row operations behind UserStore (user-store-base.ts). */
export class PgUserStore extends UserStore {
  constructor(private readonly db: PgDb) {
    super();
  }

  protected async selectAll(): Promise<UserRow[]> {
    return this.db.select().from(users).orderBy(users.name);
  }

  protected async selectByName(name: string): Promise<UserRow | null> {
    const rows = await this.db.select().from(users).where(eq(users.name, name)).limit(1);
    return rows[0] ?? null;
  }

  protected async insertRow(row: Omit<UserRow, "id">): Promise<void> {
    await this.db.insert(users).values(row);
  }

  protected async updateByName(
    name: string,
    patch: Partial<Pick<UserRow, "hashedPassword" | "role">>
  ): Promise<void> {
    await this.db.update(users).set(patch).where(eq(users.name, name));
  }

  protected async deleteByName(name: string): Promise<void> {
    await this.db.delete(users).where(eq(users.name, name));
  }
}
