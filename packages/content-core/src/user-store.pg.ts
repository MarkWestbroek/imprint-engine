import { eq } from "drizzle-orm";

import { apiTokens, users } from "./db-schema.pg";
import { UserStore, type TokenRow, type UserRow } from "./user-store-base";
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

  protected async selectTokens(userName: string): Promise<TokenRow[]> {
    return this.db.select().from(apiTokens).where(eq(apiTokens.userName, userName));
  }

  protected async selectTokenByHash(hash: string): Promise<TokenRow | null> {
    const rows = await this.db.select().from(apiTokens).where(eq(apiTokens.hash, hash)).limit(1);
    return rows[0] ?? null;
  }

  protected async insertToken(row: Omit<TokenRow, "id">): Promise<void> {
    await this.db.insert(apiTokens).values(row);
  }

  protected async updateToken(id: number, patch: Partial<Pick<TokenRow, "lastUsedAt" | "revokedAt">>): Promise<void> {
    await this.db.update(apiTokens).set(patch).where(eq(apiTokens.id, id));
  }

  protected async deleteTokensOf(userName: string): Promise<void> {
    await this.db.delete(apiTokens).where(eq(apiTokens.userName, userName));
  }
}
