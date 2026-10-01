import type { Attendance, AttendanceStatus } from "@imprint/content-core/user-store";
import type { AdminContext, AdminSession } from "@imprint/runtime-admin";
import { getEvent } from "./events";
import { isPast } from "./href";
import type { Event } from "./schemas";

/**
 * Signing up for an event (design/communities.md §4.5, step b), run through
 * the site's plugin dispatcher: komt / misschien / komt niet, and the list
 * for the organiser. A sign-up is personal data (the user store), and the
 * member agrees at the first sign-up that the organiser may see name and
 * address — the privacy text stands next to the buttons.
 */

export type ActionResult = { ok: boolean; error?: string };

export type AttendStatus = {
  signedIn: boolean;
  verified: boolean;
  /** The visitor's own answer, if any. */
  mine: AttendanceStatus | null;
  counts: Record<AttendanceStatus, number>;
  /** Sign-up is possible: asked for, not over, and (for a new "attending") not full. */
  open: boolean;
  full: boolean;
  canManage: boolean;
};

export type Attendee = { name: string; email: string | null; status: AttendanceStatus; since: string };

type Ctx = { session: AdminSession | null; users: NonNullable<AdminContext["imprint"]["users"]>; event: Event };

async function context(admin: AdminContext, slug: string): Promise<Ctx | null> {
  const users = admin.imprint.users;
  const store = admin.imprint.writableStore;
  if (!users || !store) return null;
  const event = await getEvent(store, slug);
  if (!event) return null;
  return { session: await admin.auth.getSession(), users, event };
}

const isStaff = (session: AdminSession | null) => session?.role === "admin" || session?.role === "editor";

/** The site's staff, and — for an event of a group — that group's owner and managers. */
async function canManage(ctx: Ctx): Promise<boolean> {
  if (!ctx.session) return false;
  if (isStaff(ctx.session)) return true;
  if (!ctx.event.group) return false;
  const m = await ctx.users.membership(ctx.event.group, ctx.session.name);
  return m?.status === "active" && (m.role === "owner" || m.role === "manager");
}

function count(list: Attendance[]): Record<AttendanceStatus, number> {
  const counts = { attending: 0, maybe: 0, not: 0 };
  for (const a of list) counts[a.status]++;
  return counts;
}

export async function status(admin: AdminContext, slug: string): Promise<AttendStatus | null> {
  const ctx = await context(admin, slug);
  if (!ctx) return null;
  const all = await ctx.users.attendeesOf(slug);
  const counts = count(all);
  const full = ctx.event.maxAttendees !== undefined && counts.attending >= ctx.event.maxAttendees;
  const open = ctx.event.rsvp && !isPast(ctx.event);
  if (!ctx.session) return { signedIn: false, verified: false, mine: null, counts, open, full, canManage: false };
  const user = await ctx.users.get(ctx.session.name);
  const mine = all.find((a) => a.userName === ctx.session!.name)?.status ?? null;
  return {
    signedIn: true,
    verified: isStaff(ctx.session) || (user?.emailVerified ?? false),
    mine,
    counts,
    open,
    full,
    canManage: await canManage(ctx),
  };
}

export async function attend(admin: AdminContext, slug: string, answer: AttendanceStatus): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx) return { ok: false, error: "Onbekend evenement." };
  if (!ctx.session) return { ok: false, error: "Log eerst in." };
  const user = await ctx.users.get(ctx.session.name);
  if (!user) return { ok: false, error: "Onbekende gebruiker." };
  if (!isStaff(ctx.session) && !user.emailVerified) return { ok: false, error: "Bevestig eerst je e-mailadres." };
  if (!ctx.event.rsvp) return { ok: false, error: "Voor dit evenement is geen aanmelding." };
  if (isPast(ctx.event)) return { ok: false, error: "Dit evenement is al geweest." };
  if (answer === "attending" && ctx.event.maxAttendees !== undefined) {
    const all = await ctx.users.attendeesOf(slug);
    const mine = all.find((a) => a.userName === user.name);
    if (mine?.status !== "attending" && count(all).attending >= ctx.event.maxAttendees) {
      return { ok: false, error: "Vol: het maximum aantal deelnemers is bereikt. Je kunt wel 'misschien' kiezen." };
    }
  }
  await ctx.users.attend(slug, user.name, answer);
  return { ok: true };
}

export async function withdraw(admin: AdminContext, slug: string): Promise<ActionResult> {
  const ctx = await context(admin, slug);
  if (!ctx?.session) return { ok: false, error: "Log eerst in." };
  await ctx.users.withdraw(slug, ctx.session.name);
  return { ok: true };
}

/** Who signed up, with their address — for the organiser only (the consent at sign-up covers this). */
export async function attendees(admin: AdminContext, slug: string): Promise<Attendee[] | null> {
  const ctx = await context(admin, slug);
  if (!ctx || !(await canManage(ctx))) return null;
  const list = await ctx.users.attendeesOf(slug);
  const out: Attendee[] = [];
  for (const a of list) {
    const user = await ctx.users.get(a.userName);
    out.push({ name: a.userName, email: user?.email ?? null, status: a.status, since: a.createdAt.toISOString().slice(0, 10) });
  }
  return out;
}

export const eventsActions = { status, attend, withdraw, attendees };
