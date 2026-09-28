import { createHash, randomBytes } from "node:crypto";
import { RoleType } from "./schemas";
import { hashPassword, passwordProblem, verifyPassword } from "./passwords";

/**
 * User administration (UML: User + RoleType), used by /admin/users and by the
 * `npm run user` CLI — so the rules below (last-admin guard, password policy)
 * hold no matter which door you come through.
 *
 * Deliberately *not* a ContentStore: users aren't content. They have no
 * version history on purpose — a bitemporal table keeps every row forever, and
 * superseded password hashes are exactly what you don't want to keep.
 *
 * Same split as the content stores (db-store-base.ts): everything observable
 * lives here, a dialect only supplies the five row operations below. The
 * shared contract suite (test/user-store-contract.ts) proves them equal.
 */

/** Never carries hashedPassword: this is what callers may show. */
export type UserRecord = { id: number; name: string; role: RoleType };

/** One `users` row, dialect-neutral (what every backend hands up). */
export type UserRow = { id: number; name: string; hashedPassword: string; role: string };

const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i;

/**
 * What a token may do (design/beeldbibliotheek.md §12.4). Always on top of
 * the user's own rights: a token never lets its user do more than the PDP
 * already allows them.
 */
export const TOKEN_SCOPES = ["media:upload", "media:read"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** One `api_tokens` row, dialect-neutral. */
export type TokenRow = {
  id: number;
  userName: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: string;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

/** What callers may show of a token: never the hash. */
export type TokenRecord = Omit<TokenRow, "hash" | "scopes"> & { scopes: TokenScope[]; active: boolean };

/** A presented token that holds: who it acts for, and what it may do. */
export type TokenGrant = { user: UserRecord; scopes: TokenScope[]; tokenId: number };

const TOKEN_PREFIX = "imp_";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const parseScopes = (s: string) => s.split(",").filter((x): x is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(x));

function toTokenRecord(row: TokenRow, now = new Date()): TokenRecord {
  const { hash: _hash, scopes, ...rest } = row;
  return { ...rest, scopes: parseScopes(scopes), active: !row.revokedAt && (!row.expiresAt || row.expiresAt > now) };
}

function toRecord(row: UserRow): UserRecord {
  return { id: row.id, name: row.name, role: RoleType.parse(row.role) };
}

export abstract class UserStore {
  /** All rows, ordered by name. */
  protected abstract selectAll(): Promise<UserRow[]>;
  protected abstract selectByName(name: string): Promise<UserRow | null>;
  protected abstract insertRow(row: Omit<UserRow, "id">): Promise<void>;
  protected abstract updateByName(
    name: string,
    patch: Partial<Pick<UserRow, "hashedPassword" | "role">>
  ): Promise<void>;
  protected abstract deleteByName(name: string): Promise<void>;
  // API tokens
  protected abstract selectTokens(userName: string): Promise<TokenRow[]>;
  protected abstract selectTokenByHash(hash: string): Promise<TokenRow | null>;
  protected abstract insertToken(row: Omit<TokenRow, "id">): Promise<void>;
  protected abstract updateToken(id: number, patch: Partial<Pick<TokenRow, "lastUsedAt" | "revokedAt">>): Promise<void>;
  protected abstract deleteTokensOf(userName: string): Promise<void>;

  async list(): Promise<UserRecord[]> {
    return (await this.selectAll()).map(toRecord);
  }

  async get(name: string): Promise<UserRecord | null> {
    const row = await this.selectByName(name);
    return row ? toRecord(row) : null;
  }

  /** Credentials check for login; null when they don't hold. */
  async verify(name: string, password: string): Promise<UserRecord | null> {
    const row = await this.selectByName(name);
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
    if (await this.selectByName(name)) throw new Error(`User "${name}" already exists`);

    await this.insertRow({
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
    await this.updateByName(name, { hashedPassword: hashPassword(password) });
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
    await this.updateByName(name, { role: parsed });
  }

  async remove(name: string): Promise<void> {
    await this.mustExist(name);
    await this.assertNotLastAdmin(name);
    await this.deleteTokensOf(name);
    await this.deleteByName(name);
  }

  // ---------- API tokens ----------

  /**
   * A new token for `userName`. The token itself is returned once, here, and
   * never stored: only its SHA-256.
   */
  async createToken(
    userName: string,
    name: string,
    scopes: TokenScope[],
    opts: { expiresAt?: Date | null; now?: Date } = {}
  ): Promise<{ token: string; record: TokenRecord }> {
    await this.mustExist(userName);
    const label = name.trim();
    if (!label || label.length > 64) throw new Error("A token needs a name (at most 64 characters)");
    const wanted = [...new Set(scopes)].filter((s) => (TOKEN_SCOPES as readonly string[]).includes(s));
    if (wanted.length === 0) throw new Error("A token needs at least one scope");
    const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
    const row: Omit<TokenRow, "id"> = {
      userName,
      name: label,
      prefix: token.slice(0, 12),
      hash: sha256(token),
      scopes: wanted.join(","),
      createdAt: opts.now ?? new Date(),
      expiresAt: opts.expiresAt ?? null,
      lastUsedAt: null,
      revokedAt: null,
    };
    await this.insertToken(row);
    const stored = await this.selectTokenByHash(row.hash);
    if (!stored) throw new Error("Failed to create the token");
    return { token, record: toTokenRecord(stored) };
  }

  /** The tokens of one user, newest first; revoked and expired ones included (marked inactive). */
  async tokens(userName: string): Promise<TokenRecord[]> {
    const now = new Date();
    return (await this.selectTokens(userName)).map((r) => toTokenRecord(r, now)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Check a presented token: known, not revoked, not expired, and its user
   * still exists (with the role they have now). Records the use.
   */
  async authenticate(token: string, now = new Date()): Promise<TokenGrant | null> {
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const row = await this.selectTokenByHash(sha256(token));
    if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= now)) return null;
    const user = await this.get(row.userName);
    if (!user) return null;
    await this.updateToken(row.id, { lastUsedAt: now });
    return { user, scopes: parseScopes(row.scopes), tokenId: row.id };
  }

  /** Revoke a token of `userName` (a user revokes only their own). */
  async revokeToken(userName: string, id: number): Promise<void> {
    const mine = (await this.selectTokens(userName)).find((t) => t.id === id);
    if (!mine) throw new Error("No such token");
    if (!mine.revokedAt) await this.updateToken(id, { revokedAt: new Date() });
  }

  private async mustExist(name: string): Promise<void> {
    if (!(await this.selectByName(name))) throw new Error(`No such user: "${name}"`);
  }

  /**
   * Losing the last admin means nobody can hand the role back out from the UI;
   * recovery would need the CLI on the server. Refuse instead.
   */
  private async assertNotLastAdmin(name: string): Promise<void> {
    const admins = (await this.selectAll()).filter((row) => row.role === "admin");
    if (admins.length === 1 && admins[0].name === name) {
      throw new Error(`"${name}" is the only admin — make someone else admin first`);
    }
  }
}
