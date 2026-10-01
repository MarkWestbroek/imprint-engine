import type { ContentStore, WritableContentStore } from "@imprint/content-core";
import { isPast } from "./href";
import { EventSchema, type Event } from "./schemas";

type Listing = Pick<WritableContentStore, "listItems" | "getItem">;
const canList = (store: ContentStore): store is ContentStore & Listing =>
  typeof (store as Partial<Listing>).listItems === "function";

/**
 * Current events as the store's reader may see them. `upcoming`: not over
 * yet, soonest first; `past`: over, most recent first; absent: everything,
 * soonest first.
 */
export async function listEvents(
  store: ContentStore,
  opts: { group?: string; tag?: string; when?: "upcoming" | "past"; now?: Date } = {}
): Promise<Event[]> {
  if (!canList(store)) return [];
  const now = opts.now ?? new Date();
  const records = await store.listItems("event");
  const events = records
    .map((r) => EventSchema.safeParse(r.data))
    .filter((r) => r.success)
    .map((r) => r.data)
    .filter((e) => (opts.group === undefined || e.group === opts.group) && (!opts.tag || e.tags.includes(opts.tag)))
    .filter((e) => (opts.when === "upcoming" ? !isPast(e, now) : opts.when === "past" ? isPast(e, now) : true));
  const byStart = (a: Event, b: Event) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "nl");
  return opts.when === "past" ? events.sort((a, b) => byStart(b, a)) : events.sort(byStart);
}

export async function getEvent(store: ContentStore, slug: string): Promise<Event | null> {
  if (!canList(store)) return null;
  const record = await store.getItem("event", slug);
  const parsed = record ? EventSchema.safeParse(record.data) : null;
  return parsed?.success ? parsed.data : null;
}
