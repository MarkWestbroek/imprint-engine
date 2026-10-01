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
export type UserRecord = { id: number; name: string; role: RoleType; email: string | null; emailVerified: boolean };

export type UserRow = {
  id: number;
  name: string;
  hashedPassword: string;
  role: string;
  email: string | null;
  emailVerifiedAt: Date | null;
};

const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One-time e-mail tokens: what they are for. */
export const EMAIL_TOKEN_PURPOSES = ["verify", "reset"] as const;
export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];
export type EmailTokenRow = {
  id: number;
  userName: string;
  purpose: string;
  hash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
};

/** Group membership (design/communities.md §4.1–4.2): personal data, not content. */
export const MEMBERSHIP_ROLES = ["owner", "manager", "member"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export const MEMBERSHIP_STATUSES = ["requested", "active"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export type MembershipRow = {
  id: number;
  groupSlug: string;
  userName: string;
  role: string;
  status: string;
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
};
export type Membership = Omit<MembershipRow, "role" | "status"> & { role: MembershipRole; status: MembershipStatus };

/** A sign-up for an event: komt / misschien / komt niet. */
export const ATTENDANCE_STATUSES = ["attending", "maybe", "not"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type AttendanceRow = {
  id: number;
  eventSlug: string;
  userName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  consentAt: Date;
};
export type Attendance = Omit<AttendanceRow, "status"> & { status: AttendanceStatus };
const asAttendance = (row: AttendanceRow): Attendance => ({
  ...row,
  status: (ATTENDANCE_STATUSES as readonly string[]).includes(row.status) ? (row.status as AttendanceStatus) : "maybe",
});

/** One notification for one member (design/communities.md §4.4). */
export type NotificationRow = {
  id: number;
  userName: string;
  kind: string;
  title: string;
  href: string;
  actor: string | null;
  createdAt: Date;
  readAt: Date | null;
  mailedAt: Date | null;
};
export type Notification = NotificationRow;
export type NotificationInput = { kind: string; title: string; href: string; actor?: string | null };

export type InviteRow = {
  id: number;
  groupSlug: string;
  hash: string;
  role: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  uses: number;
};
export type Invite = Omit<InviteRow, "hash" | "role"> & { role: MembershipRole; active: boolean };

const asRole = (r: string): MembershipRole => (MEMBERSHIP_ROLES as readonly string[]).includes(r) ? (r as MembershipRole) : "member";
const asStatus = (s: string): MembershipStatus => (s === "active" ? "active" : "requested");
const toMembership = (row: MembershipRow): Membership => ({ ...row, role: asRole(row.role), status: asStatus(row.status) });

/**
 * What a token may do (design/beeldbibliotheek.md §12.4). Always on top of
 * the user's own rights: a token never lets its user do more than the PDP
 * already allows them.
 */
export const TOKEN_SCOPES = ["media:upload", "media:read", "patch:propose"] as const;
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
  return { id: row.id, name: row.name, role: RoleType.parse(row.role), email: row.email, emailVerified: row.emailVerifiedAt !== null };
}

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export abstract class UserStore {
  /** All rows, ordered by name. */
  protected abstract selectAll(): Promise<UserRow[]>;
  protected abstract selectByName(name: string): Promise<UserRow | null>;
  protected abstract selectByEmail(email: string): Promise<UserRow | null>;
  protected abstract insertRow(row: Omit<UserRow, "id">): Promise<void>;
  protected abstract updateByName(
    name: string,
    patch: Partial<Pick<UserRow, "hashedPassword" | "role" | "email" | "emailVerifiedAt">>
  ): Promise<void>;
  protected abstract deleteByName(name: string): Promise<void>;
  // E-mail tokens
  protected abstract insertEmailToken(row: Omit<EmailTokenRow, "id">): Promise<void>;
  protected abstract selectEmailTokenByHash(hash: string): Promise<EmailTokenRow | null>;
  protected abstract updateEmailToken(id: number, patch: Partial<Pick<EmailTokenRow, "usedAt">>): Promise<void>;
  protected abstract deleteEmailTokensOf(userName: string): Promise<void>;
  // Memberships
  protected abstract selectMembershipsOfUser(userName: string): Promise<MembershipRow[]>;
  protected abstract selectMembershipsOfGroup(groupSlug: string): Promise<MembershipRow[]>;
  protected abstract selectMembership(groupSlug: string, userName: string): Promise<MembershipRow | null>;
  protected abstract insertMembership(row: Omit<MembershipRow, "id">): Promise<void>;
  protected abstract updateMembership(id: number, patch: Partial<Pick<MembershipRow, "role" | "status" | "decidedAt" | "decidedBy">>): Promise<void>;
  protected abstract deleteMembership(id: number): Promise<void>;
  protected abstract deleteMembershipsOf(userName: string): Promise<void>;
  // Attendances
  protected abstract selectAttendancesOfEvent(eventSlug: string): Promise<AttendanceRow[]>;
  protected abstract selectAttendancesOfUser(userName: string): Promise<AttendanceRow[]>;
  protected abstract selectAttendance(eventSlug: string, userName: string): Promise<AttendanceRow | null>;
  protected abstract insertAttendance(row: Omit<AttendanceRow, "id">): Promise<void>;
  protected abstract updateAttendance(id: number, patch: Partial<Pick<AttendanceRow, "status" | "updatedAt">>): Promise<void>;
  protected abstract deleteAttendance(id: number): Promise<void>;
  protected abstract deleteAttendancesOf(userName: string): Promise<void>;

  // Notifications
  protected abstract selectNotificationsOf(userName: string, limit: number): Promise<NotificationRow[]>;
  protected abstract countUnread(userName: string): Promise<number>;
  protected abstract selectUnmailed(): Promise<NotificationRow[]>;
  protected abstract insertNotification(row: Omit<NotificationRow, "id">): Promise<void>;
  protected abstract markNotifications(userName: string, ids: number[] | null, patch: Partial<Pick<NotificationRow, "readAt" | "mailedAt">>): Promise<void>;
  protected abstract markMailed(ids: number[], at: Date): Promise<void>;
  protected abstract deleteNotificationsOf(userName: string): Promise<void>;
  // Invites
  protected abstract insertInvite(row: Omit<InviteRow, "id">): Promise<void>;
  protected abstract selectInvitesOfGroup(groupSlug: string): Promise<InviteRow[]>;
  protected abstract selectInviteByHash(hash: string): Promise<InviteRow | null>;
  protected abstract updateInvite(id: number, patch: Partial<Pick<InviteRow, "uses" | "expiresAt">>): Promise<void>;
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

  async getByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.selectByEmail(normaliseEmail(email));
    return row ? toRecord(row) : null;
  }

  /** Credentials check for login, by name or by e-mail address; null when they don't hold. */
  async verify(identifier: string, password: string): Promise<UserRecord | null> {
    const row = identifier.includes("@") ? await this.selectByEmail(normaliseEmail(identifier)) : await this.selectByName(identifier);
    if (!row || !verifyPassword(password, row.hashedPassword)) return null;
    return toRecord(row);
  }

  /**
   * Self-registration (design/communities.md §4.1): a member with an e-mail
   * address that is not verified yet. The lightest role, `reader`, is what a
   * member is: may read what is for members, may not edit the site.
   */
  async register(name: string, email: string, password: string): Promise<UserRecord> {
    const address = normaliseEmail(email);
    if (!EMAIL_RE.test(address)) throw new Error("That is not an e-mail address");
    if (await this.selectByEmail(address)) throw new Error("That e-mail address is already registered");
    const user = await this.create(name, password, "reader");
    await this.updateByName(user.name, { email: address, emailVerifiedAt: null });
    return (await this.get(user.name))!;
  }

  /** Set (or change) an address; verification starts over. */
  async setEmail(name: string, email: string): Promise<void> {
    const address = normaliseEmail(email);
    if (!EMAIL_RE.test(address)) throw new Error("That is not an e-mail address");
    await this.mustExist(name);
    const holder = await this.selectByEmail(address);
    if (holder && holder.name !== name) throw new Error("That e-mail address is already registered");
    await this.updateByName(name, { email: address, emailVerifiedAt: null });
  }

  // ---------- E-mail tokens ----------

  /** A one-time token for a mail link; only its hash is stored. Returns the raw token, to put in the link. */
  async createEmailToken(name: string, purpose: EmailTokenPurpose, ttlHours = 24, now = new Date()): Promise<string> {
    await this.mustExist(name);
    const token = randomBytes(24).toString("base64url");
    await this.insertEmailToken({
      userName: name,
      purpose,
      hash: sha256(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlHours * 3600_000),
      usedAt: null,
    });
    return token;
  }

  /**
   * Use a token once: the user it belongs to, or null when it is unknown,
   * for another purpose, expired or used before. A "verify" token marks the
   * address as verified.
   */
  async consumeEmailToken(token: string, purpose: EmailTokenPurpose, now = new Date()): Promise<UserRecord | null> {
    const row = await this.selectEmailTokenByHash(sha256(token));
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now) return null;
    await this.updateEmailToken(row.id, { usedAt: now });
    if (purpose === "verify") await this.updateByName(row.userName, { emailVerifiedAt: now });
    return this.get(row.userName);
  }

  // ---------- Memberships ----------

  async membershipsOf(userName: string): Promise<Membership[]> {
    return (await this.selectMembershipsOfUser(userName)).map(toMembership);
  }

  async membersOf(groupSlug: string): Promise<Membership[]> {
    return (await this.selectMembershipsOfGroup(groupSlug)).map(toMembership);
  }

  async membership(groupSlug: string, userName: string): Promise<Membership | null> {
    const row = await this.selectMembership(groupSlug, userName);
    return row ? toMembership(row) : null;
  }

  /**
   * Join a group, or ask to: a new membership with `status`, or the existing
   * one brought to it (a request that is approved, an invite that activates).
   * A membership that is already active is left as it is.
   */
  async join(
    groupSlug: string,
    userName: string,
    opts: { role?: MembershipRole; status: MembershipStatus; by?: string },
    now = new Date()
  ): Promise<Membership> {
    await this.mustExist(userName);
    const existing = await this.selectMembership(groupSlug, userName);
    if (existing) {
      if (existing.status !== "active") {
        await this.updateMembership(existing.id, {
          status: opts.status,
          role: opts.role ?? existing.role,
          decidedAt: opts.status === "active" ? now : null,
          decidedBy: opts.status === "active" ? (opts.by ?? userName) : null,
        });
      }
    } else {
      await this.insertMembership({
        groupSlug,
        userName,
        role: opts.role ?? "member",
        status: opts.status,
        createdAt: now,
        decidedAt: opts.status === "active" ? now : null,
        decidedBy: opts.status === "active" ? (opts.by ?? userName) : null,
      });
    }
    return (await this.membership(groupSlug, userName))!;
  }

  /** The manager's decisions: approve (status active), change a role. */
  async setMembership(
    groupSlug: string,
    userName: string,
    patch: { role?: MembershipRole; status?: MembershipStatus },
    by: string,
    now = new Date()
  ): Promise<Membership> {
    const existing = await this.selectMembership(groupSlug, userName);
    if (!existing) throw new Error(`"${userName}" is no member of "${groupSlug}"`);
    await this.updateMembership(existing.id, {
      ...(patch.role ? { role: patch.role } : {}),
      ...(patch.status ? { status: patch.status, decidedAt: now, decidedBy: by } : {}),
    });
    return (await this.membership(groupSlug, userName))!;
  }

  /** Leave, be rejected or be removed: the membership goes. */
  async leave(groupSlug: string, userName: string): Promise<void> {
    const existing = await this.selectMembership(groupSlug, userName);
    if (existing) await this.deleteMembership(existing.id);
  }

  // ---------- Attendances (design/communities.md §4.5) ----------

  async attendeesOf(eventSlug: string): Promise<Attendance[]> {
    return (await this.selectAttendancesOfEvent(eventSlug)).map(asAttendance);
  }

  async attendancesOf(userName: string): Promise<Attendance[]> {
    return (await this.selectAttendancesOfUser(userName)).map(asAttendance);
  }

  async attendance(eventSlug: string, userName: string): Promise<Attendance | null> {
    const row = await this.selectAttendance(eventSlug, userName);
    return row ? asAttendance(row) : null;
  }

  /** Sign up, or change the answer; the consent moment is kept from the first time. */
  async attend(eventSlug: string, userName: string, status: AttendanceStatus, now = new Date()): Promise<Attendance> {
    await this.mustExist(userName);
    if (!(ATTENDANCE_STATUSES as readonly string[]).includes(status)) throw new Error(`Unknown attendance status "${status}"`);
    const existing = await this.selectAttendance(eventSlug, userName);
    if (existing) await this.updateAttendance(existing.id, { status, updatedAt: now });
    else await this.insertAttendance({ eventSlug, userName, status, createdAt: now, updatedAt: now, consentAt: now });
    return (await this.attendance(eventSlug, userName))!;
  }

  /** Withdraw: the sign-up (and with it the consent) goes. */
  async withdraw(eventSlug: string, userName: string): Promise<void> {
    const existing = await this.selectAttendance(eventSlug, userName);
    if (existing) await this.deleteAttendance(existing.id);
  }

  // ---------- Invites ----------

  /** An invitation link's code (only its hash is stored); whoever redeems it joins with `role`. */
  async createInvite(groupSlug: string, role: MembershipRole, by: string, days = 30, now = new Date()): Promise<string> {
    const code = randomBytes(18).toString("base64url");
    await this.insertInvite({
      groupSlug,
      hash: sha256(code),
      role,
      createdBy: by,
      createdAt: now,
      expiresAt: new Date(now.getTime() + days * 86400_000),
      uses: 0,
    });
    return code;
  }

  async invitesOf(groupSlug: string, now = new Date()): Promise<Invite[]> {
    return (await this.selectInvitesOfGroup(groupSlug)).map(({ hash: _hash, ...row }) => ({
      ...row,
      role: asRole(row.role),
      active: row.expiresAt > now,
    }));
  }

  /** Redeem a code for `userName`: an active membership with the invite's role, or null when the code is unknown or expired. */
  async redeemInvite(code: string, userName: string, now = new Date()): Promise<Membership | null> {
    const row = await this.selectInviteByHash(sha256(code));
    if (!row || row.expiresAt <= now) return null;
    await this.updateInvite(row.id, { uses: row.uses + 1 });
    const existing = await this.selectMembership(row.groupSlug, userName);
    if (existing?.status === "active") return toMembership(existing);
    return this.join(row.groupSlug, userName, { role: asRole(row.role), status: "active", by: row.createdBy }, now);
  }

  /** End an invitation link early. */
  async revokeInvite(groupSlug: string, id: number, now = new Date()): Promise<void> {
    const invite = (await this.selectInvitesOfGroup(groupSlug)).find((i) => i.id === id);
    if (invite) await this.updateInvite(id, { expiresAt: now });
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
      email: null,
      emailVerifiedAt: null,
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
    await this.deleteEmailTokensOf(name);
    await this.deleteMembershipsOf(name);
    await this.deleteAttendancesOf(name);
    await this.deleteNotificationsOf(name);
    await this.deleteByName(name);
  }

  // ---------- Notifications (design/communities.md §4.4, G3c) ----------

  /** Tell a member something happened; an unknown member is an error (the engine filters). */
  async notify(userName: string, input: NotificationInput, now = new Date()): Promise<void> {
    await this.mustExist(userName);
    const title = String(input.title ?? "").trim().slice(0, 255);
    const href = String(input.href ?? "");
    if (!title) throw new Error("A notification needs a title");
    if (!/^\/[^\s]*$/.test(href)) throw new Error("A notification links to a path on this site");
    await this.insertNotification({ userName, kind: String(input.kind ?? "").slice(0, 32), title, href, actor: input.actor ?? null, createdAt: now, readAt: null, mailedAt: null });
  }

  /** A member's notifications, newest first. */
  async notificationsOf(userName: string, limit = 50): Promise<Notification[]> {
    return this.selectNotificationsOf(userName, limit);
  }

  async unreadNotifications(userName: string): Promise<number> {
    return this.countUnread(userName);
  }

  /** Mark some (or all) of a member's notifications as read. */
  async markRead(userName: string, ids: number[] | null = null, now = new Date()): Promise<void> {
    await this.markNotifications(userName, ids, { readAt: now });
  }

  /** What the mail digest has not sent yet, oldest first, across members. */
  async unmailedNotifications(): Promise<Notification[]> {
    return this.selectUnmailed();
  }

  async markMailedNotifications(ids: number[], now = new Date()): Promise<void> {
    if (ids.length > 0) await this.markMailed(ids, now);
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
