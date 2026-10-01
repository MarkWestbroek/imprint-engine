import Link from "next/link";
import { z } from "zod";
import type { WidgetContext } from "@imprint/runtime-admin";
import { EventList } from "./event-list";
import { listEvents } from "./events";
import { eventsHref } from "./href";

/**
 * The agenda as a block on a page: the next events of the site, one group
 * or one tag. Reads through the visitor's store, so a members-only event
 * never reaches a prerendered page. "Upcoming" is judged at render time, so
 * a prerendered page shows what was upcoming at its last build (revalidated
 * on saves; a daily rebuild keeps it fresh — backlog).
 */
export const EventsConfig = z.object({
  title: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(5),
  group: z.string().default(""),
  tag: z.string().default(""),
  /** Show what is over instead of what is coming. */
  past: z.boolean().default(false),
  showMore: z.boolean().default(true),
});
export type EventsConfig = z.infer<typeof EventsConfig>;

export async function EventsWidget({ config, ctx }: { config: EventsConfig; ctx: WidgetContext }) {
  const events = await listEvents(ctx.store, {
    group: config.group || undefined,
    tag: config.tag || undefined,
    when: config.past ? "past" : "upcoming",
  });
  return (
    <section>
      {config.title && <h2 className="mb-2 text-2xl font-semibold tracking-tight">{config.title}</h2>}
      <EventList events={events.slice(0, config.limit)} byMonth={false} />
      {config.showMore && (
        <p className="mt-3 text-sm">
          <Link href={eventsHref()} className="font-semibold text-accent hover:underline">
            Hele agenda →
          </Link>
        </p>
      )}
    </section>
  );
}
