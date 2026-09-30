import { and, eq } from "drizzle-orm";

import { apiTokens, emailTokens, invites, memberships, users } from "./db-schema.pg";
import {
  UserStore,
  type EmailTokenRow,
  type InviteRow,
  type MembershipRow,
  type TokenRow,
  type UserRow,
} from "./user-store-base";
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
    patch: Partial<Pick<UserRow, "hashedPassword" | "role" | "email" | "emailVerifiedAt">>
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

  protected async selectByEmail(email: string): Promise<UserRow | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ?? null;
  }

  // E-mail tokens
  protected async insertEmailToken(row: Omit<EmailTokenRow, "id">): Promise<void> {
    await this.db.insert(emailTokens).values(row);
  }

  protected async selectEmailTokenByHash(hash: string): Promise<EmailTokenRow | null> {
    const rows = await this.db.select().from(emailTokens).where(eq(emailTokens.hash, hash)).limit(1);
    return rows[0] ?? null;
  }

  protected async updateEmailToken(id: number, patch: Partial<Pick<EmailTokenRow, "usedAt">>): Promise<void> {
    await this.db.update(emailTokens).set(patch).where(eq(emailTokens.id, id));
  }

  protected async deleteEmailTokensOf(userName: string): Promise<void> {
    await this.db.delete(emailTokens).where(eq(emailTokens.userName, userName));
  }

  // Memberships
  protected async selectMembershipsOfUser(userName: string): Promise<MembershipRow[]> {
    return this.db.select().from(memberships).where(eq(memberships.userName, userName)).orderBy(memberships.groupSlug);
  }

  protected async selectMembershipsOfGroup(groupSlug: string): Promise<MembershipRow[]> {
    return this.db.select().from(memberships).where(eq(memberships.groupSlug, groupSlug)).orderBy(memberships.userName);
  }

  protected async selectMembership(groupSlug: string, userName: string): Promise<MembershipRow | null> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupSlug, groupSlug), eq(memberships.userName, userName)))
      .limit(1);
    return rows[0] ?? null;
  }

  protected async insertMembership(row: Omit<MembershipRow, "id">): Promise<void> {
    await this.db.insert(memberships).values(row);
  }

  protected async updateMembership(
    id: number,
    patch: Partial<Pick<MembershipRow, "role" | "status" | "decidedAt" | "decidedBy">>
  ): Promise<void> {
    await this.db.update(memberships).set(patch).where(eq(memberships.id, id));
  }

  protected async deleteMembership(id: number): Promise<void> {
    await this.db.delete(memberships).where(eq(memberships.id, id));
  }

  protected async deleteMembershipsOf(userName: string): Promise<void> {
    await this.db.delete(memberships).where(eq(memberships.userName, userName));
  }

  // Invites
  protected async insertInvite(row: Omit<InviteRow, "id">): Promise<void> {
    await this.db.insert(invites).values(row);
  }

  protected async selectInvitesOfGroup(groupSlug: string): Promise<InviteRow[]> {
    return this.db.select().from(invites).where(eq(invites.groupSlug, groupSlug)).orderBy(invites.createdAt);
  }

  protected async selectInviteByHash(hash: string): Promise<InviteRow | null> {
    const rows = await this.db.select().from(invites).where(eq(invites.hash, hash)).limit(1);
    return rows[0] ?? null;
  }

  protected async updateInvite(id: number, patch: Partial<Pick<InviteRow, "uses" | "expiresAt">>): Promise<void> {
    await this.db.update(invites).set(patch).where(eq(invites.id, id));
  }
}
