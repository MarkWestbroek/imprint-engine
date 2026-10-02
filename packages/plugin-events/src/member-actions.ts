import { revalidatePath } from "next/cache";
import { permit, type WritableContentStore } from "@imprint/content-core";
import { itemChanged, type AdminContext } from "@imprint/runtime-admin";
import { notifyGroup, subjectFor } from "@imprint/runtime-admin/admin-server";
import { getEvent, listEvents } from "./events";
import { eventHref, eventSlug, eventsHref, isPast, withZone } from "./href";
import type { Event } from "./schemas";

/**
 * Members plan events in their group (design/communities.md §4.5, G3a+).
 * The same policy as for posts, nothing of its own: create in a group you
 * belong to, as yourself (`author`); keep changing and removing what you
 * made; the group's managers may remove. An event is content, written as the
 * member. Which group that is, the plugin reads by type name (`group`) —
 * it does not import the groups plugin.
 */

export type ActionResult = { ok: boolean; error?: string; slug?: string };

/** What the form holds. Times as the member types them: local, `YYYY-MM-DDTHH:MM`, read as Europe/Amsterdam. */
export type EventInput = {
  title: string;
  start: string;
  end: string;
  location: string;
  online: boolean;
  /** Members may sign up (komt / misschien / komt niet). */
  rsvp: boolean;
  body: string;
  membersOnly: boolean;
};

export type EventRights = { group: string; own: boolean; canEdit: boolean; canRemove: boolean };
export type GroupAgenda = { mayCreate: boolean; closed: boolean; membersOnly: { slug: string; title: string; start: string; location: string }[] };

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const resourceOf = (slug: string, e: { access?: string; group?: string; author?: string }) => ({
  type: "event",
  id: slug,
  properties: { access: e.access ?? "public", group: e.group ?? "", author: e.author ?? "" },
});

/** The group's page and the agenda show the event; a path of the groups plugin, by convention (`/groups/<slug>`). */
function touched(group: string, slug: string) {
  for (const path of [eventsHref(), eventHref(slug), `/groups/${group}`, `/members/groups/${group}`]) revalidatePath(path);
}

function parse(input: EventInput): { error: string } | { title: string; start: string; end: string; location: string; body: string } {
  const title = String(input?.title ?? "").trim();
  if (title.length < 2 || title.length > 160) return { error: "Geef een titel van 2 tot 160 tekens." };
  if (!LOCAL.test(String(input?.start ?? ""))) return { error: "Kies een begintijd." };
  if (input.end && !LOCAL.test(input.end)) return { error: "De eindtijd klopt niet." };
  if (input.end && input.end < input.start) return { error: "Het einde ligt voor het begin." };
  const body = String(input?.body ?? "").trim();
  if (body.length > 20000) return { error: "De beschrijving is te lang (hooguit 20.000 tekens)." };
  return { title, start: withZone(input.start), end: input.end ? withZone(input.end) : "", location: String(input?.location ?? "").trim().slice(0, 200), body };
}

/** For the group's page: may this visitor plan here, and the events only members see (the page itself shows the public ones). */
export async function agenda(admin: AdminContext, group: string): Promise<GroupAgenda | null> {
  const store = admin.imprint.writableStore;
  const session = await admin.auth.getSession();
  if (!store || !session) return null;
  const record = await store.getItem("group", group, "en");
  if (!record) return null;
  const subject = await subjectFor(admin, session);
  const mayCreate = await permit(admin.imprint.pdp, subject, "create", resourceOf("new", { access: `group:${group}`, group, author: session.name }));
  const events = await listEvents(admin.imprint.storeFor(subject), { group });
  return {
    mayCreate,
    closed: !!(record.data as { closed?: boolean }).closed,
    membersOnly: events.filter((e) => e.access !== "public" && !isPast(e)).map((e) => ({ slug: e.slug, title: e.title, start: e.start, location: e.location })),
  };
}

export async function writeEvent(admin: AdminContext, group: string, input: EventInput): Promise<ActionResult> {
  const store = admin.imprint.writableStore;
  const session = await admin.auth.getSession();
  if (!store) return { ok: false, error: "Plannen kan alleen met een database." };
  if (!session) return { ok: false, error: "Log eerst in." };
  const groupRecord = await store.getItem("group", group, "en");
  if (!groupRecord) return { ok: false, error: "Onbekende groep." };
  const parsed = parse(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const access = input.membersOnly ? `group:${group}` : "public";
  const base = `${group}-${eventSlug(parsed.title)}`.slice(0, 100);
  let slug = base;
  for (let n = 2; await store.getItem("event", slug, "en"); n++) slug = `${base}-${n}`;
  const subject = await subjectFor(admin, session);
  if (!(await permit(admin.imprint.pdp, subject, "create", resourceOf(slug, { access, group, author: session.name })))) {
    return { ok: false, error: "Alleen leden van deze community kunnen hier iets plannen." };
  }
  const event = { slug, lang: "en", access, ...parsed, online: !!input.online, rsvp: !!input.rsvp, organizer: session.name, author: session.name, group, tags: [] };
  await store.putItem("event", slug, event, { lang: "en", by: session.name });
  touched(group, slug);
  const groupTitle = String((groupRecord.data as { title?: string }).title ?? group);
  await notifyGroup(admin, group, { kind: "event", title: `${session.name} plant in ${groupTitle}: ${parsed.title}`, href: eventHref(slug), actor: session.name });
  return { ok: true, slug };
}

async function own(admin: AdminContext, slug: string): Promise<{ store: WritableContentStore; name: string; event: Event; rights: EventRights } | null> {
  const store = admin.imprint.writableStore;
  const session = await admin.auth.getSession();
  if (!store || !session) return null;
  const event = await getEvent(store, slug);
  if (!event?.group) return null;
  const subject = await subjectFor(admin, session);
  const resource = resourceOf(slug, event);
  const [canEdit, canRemove] = await Promise.all([permit(admin.imprint.pdp, subject, "update", resource), permit(admin.imprint.pdp, subject, "delete", resource)]);
  return { store, name: session.name, event, rights: { group: event.group, own: event.author === session.name, canEdit, canRemove } };
}

/** What this visitor may do with an event of a group (the event page's tools). */
export async function rights(admin: AdminContext, slug: string): Promise<EventRights | null> {
  return (await own(admin, slug))?.rights ?? null;
}

/** The event as the form holds it: the times back to local. */
export async function eventInput(admin: AdminContext, slug: string): Promise<EventInput | null> {
  const got = await own(admin, slug);
  if (!got?.rights.canEdit) return null;
  const { event } = got;
  const local = (iso: string) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" }).replace(" ", "T").slice(0, 16) : "");
  return { title: event.title, start: local(event.start), end: local(event.end), location: event.location, online: event.online, rsvp: event.rsvp, body: event.body, membersOnly: event.access !== "public" };
}

export async function editEvent(admin: AdminContext, slug: string, input: EventInput): Promise<ActionResult> {
  const got = await own(admin, slug);
  if (!got) return { ok: false, error: "Log eerst in." };
  if (!got.rights.canEdit) return { ok: false, error: "Je kunt alleen je eigen evenementen bewerken." };
  const parsed = parse(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { event, store, name } = got;
  await store.putItem("event", slug, { ...event, ...parsed, online: !!input.online, rsvp: !!input.rsvp, access: input.membersOnly ? `group:${event.group}` : "public" }, { lang: "en", by: name });
  touched(event.group, slug);
  await itemChanged(admin, { type: "event", slug, by: name });
  return { ok: true, slug };
}

export async function removeEvent(admin: AdminContext, slug: string): Promise<ActionResult> {
  const got = await own(admin, slug);
  if (!got) return { ok: false, error: "Log eerst in." };
  if (!got.rights.canRemove) return { ok: false, error: "Je kunt alleen je eigen evenementen verwijderen." };
  await got.store.deleteItem("event", slug, "en");
  touched(got.event.group, slug);
  return { ok: true };
}

export const memberEventActions = { agenda, writeEvent, rights, eventInput, editEvent, removeEvent };
