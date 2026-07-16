import { eq } from "drizzle-orm";

import { users } from "./db-schema";
import { RoleType } from "./schemas";
import { hashPassword, passwordProblem, verifyPassword } from "./passwords";
import type { Db } from "./db-store";

/**
 * User administration (UML: User + RoleType), used by /admin/users and by the
 * `npm run user` CLI — so the rules below (last-admin guard, password policy)
 * hold no matter which door you come through.
 *
 * Deliberately *not* a ContentStore: users aren't content. They have no
 * version history on purpose — a bitemporal table keeps every row forever, and
 * superseded password hashes are exactly what you don't want to keep.
 */

/** Never carries hashedPassword: this is what callers may show. */
export type UserRecord = { id: number; name: string; role: RoleType };

const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i;

function toRecord(row: typeof users.$inferSelect): UserRecord {
  return { id: row.id, name: row.name, role: RoleType.parse(row.role) };
}

export class DbUserStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<UserRecord[]> {
    const rows = await this.db.select().from(users).orderBy(users.name);
    return rows.map(toRecord);
  }

  async get(name: string): Promise<UserRecord | null> {
    const row = await this.row(name);
    return row ? toRecord(row) : null;
  }

  /** Credentials check for login; null when they don't hold. */
  async verify(name: string, password: string): Promise<UserRecord | null> {
    const row = await this.row(name);
    if (!row || !verifyPassword(password, row.hashedPassword)) return null;
    return toRecord(row);
  }

  async create(name: string, password: string, role: RoleType): Promise<UserRecord> {
    if (!NAME_RE.test(name)) {
      throw new Error(
        "Username must be 2-64 chars: letters, digits, dot, dash or underscore"
      );
    }
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    if (await this.row(name)) throw new Error(`User "${name}" already exists`);

    await this.db.insert(users).values({
      name,
      hashedPassword: hashPassword(password),
      role: RoleType.parse(role),
    });
    const created = await this.get(name);
    if (!created) throw new Error(`Failed to create "${name}"`);
    return created;
  }

  async setPassword(name: string, password: string): Promise<void> {
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    await this.mustExist(name);
    await this.db
      .update(users)
      .set({ hashedPassword: hashPassword(password) })
      .where(eq(users.name, name));
  }

  /** Change own password: the current one has to check out first. */
  async changePassword(name: string, current: string, next: string): Promise<void> {
    if (!(await this.verify(name, current))) throw new Error("Current password is wrong");
    await this.setPassword(name, next);
  }

  async setRole(name: string, role: RoleType): Promise<void> {
    const parsed = RoleType.parse(role);
    await this.mustExist(name);
    if (parsed !== "admin") await this.assertNotLastAdmin(name);
    await this.db.update(users).set({ role: parsed }).where(eq(users.name, name));
  }

  async remove(name: string): Promise<void> {
    await this.mustExist(name);
    await this.assertNotLastAdmin(name);
    await this.db.delete(users).where(eq(users.name, name));
  }

  private async row(name: string) {
    const rows = await this.db.select().from(users).where(eq(users.name, name)).limit(1);
    return rows[0] ?? null;
  }

  private async mustExist(name: string): Promise<void> {
    if (!(await this.row(name))) throw new Error(`No such user: "${name}"`);
  }

  /**
   * Losing the last admin means nobody can hand the role back out from the UI;
   * recovery would need the CLI on the server. Refuse instead.
   */
  private async assertNotLastAdmin(name: string): Promise<void> {
    const admins = await this.db.select().from(users).where(eq(users.role, "admin"));
    if (admins.length === 1 && admins[0].name === name) {
      throw new Error(`"${name}" is the only admin — make someone else admin first`);
    }
  }
}
