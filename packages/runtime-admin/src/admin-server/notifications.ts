import type { Notification, NotificationInput } from "@imprint/content-core/user-store";
import type { AdminContext } from "../admin-context";

/**
 * Notifications (design/communities.md §4.4, G3c): plugins tell members what
 * happened through `notify`; the member reads them in the inbox and, later,
 * in the mail digest. Emitting never fails an action: an unknown recipient
 * or a missing user store is silently nothing. The actor never hears about
 * their own deed.
 */

export async function notify(admin: Pick<AdminContext, "imprint">, to: string | string[], input: NotificationInput): Promise<void> {
  const users = admin.imprint.users;
  if (!users) return;
  const names = [...new Set(Array.isArray(to) ? to : [to])].filter((n) => n && n !== input.actor);
  for (const name of names) {
    await users.notify(name, input).catch(() => undefined);
  }
}

/** Every active member of a group, except the actor and `except`. */
export async function notifyGroup(admin: Pick<AdminContext, "imprint">, groupSlug: string, input: NotificationInput, except: string[] = []): Promise<void> {
  const users = admin.imprint.users;
  if (!users) return;
  const members = (await users.membersOf(groupSlug)).filter((m) => m.status === "active" && !except.includes(m.userName));
  await notify(admin, members.map((m) => m.userName), input);
}

/** The managers (owner and managers) of a group. */
export async function notifyManagers(admin: Pick<AdminContext, "imprint">, groupSlug: string, input: NotificationInput): Promise<void> {
  const users = admin.imprint.users;
  if (!users) return;
  const managers = (await users.membersOf(groupSlug)).filter((m) => m.status === "active" && (m.role === "owner" || m.role === "manager"));
  await notify(admin, managers.map((m) => m.userName), input);
}

export type Inbox = { items: Notification[]; unread: number };

/** The signed-in member's inbox; null when not signed in. */
export async function myNotifications(admin: AdminContext, limit = 50): Promise<Inbox | null> {
  const session = await admin.auth.getSession();
  const users = admin.imprint.users;
  if (!session || !users) return null;
  return { items: await users.notificationsOf(session.name, limit), unread: await users.unreadNotifications(session.name) };
}

export async function unreadNotifications(admin: AdminContext): Promise<number> {
  const session = await admin.auth.getSession();
  const users = admin.imprint.users;
  if (!session || !users) return 0;
  return users.unreadNotifications(session.name);
}

/** Mark the signed-in member's notifications (some, or all) as read. */
export async function markNotificationsRead(admin: AdminContext, ids: number[] | null = null): Promise<void> {
  const session = await admin.auth.getSession();
  const users = admin.imprint.users;
  if (!session || !users) return;
  await users.markRead(session.name, ids);
}
