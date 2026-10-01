import Link from "next/link";
import { eventHref, eventSummary, formatDay, formatMonth, formatTime } from "./href";
import type { Event } from "./schemas";

/** Events as an agenda: grouped by month, with day, time and place. Server-rendered. */
export function EventList({ events, byMonth = true, showSummary = false }: { events: Event[]; byMonth?: boolean; showSummary?: boolean }) {
  if (events.length === 0) return <p className="text-muted">Geen evenementen.</p>;
  const groups = new Map<string, Event[]>();
  for (const e of events) {
    const key = byMonth ? formatMonth(e.start) : "";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return (
    <div className="space-y-6">
      {[...groups].map(([month, list]) => (
        <section key={month || "all"}>
          {month && <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{month}</h3>}
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.slug} className="flex gap-4 py-3">
                <time dateTime={e.start} className="w-28 shrink-0 text-sm text-muted">
                  {formatDay(e.start).replace(/ \d{4}$/, "")}
                  <br />
                  {formatTime(e.start)}
                  {e.end && `–${formatTime(e.end)}`}
                </time>
                <div className="min-w-0">
                  <Link href={eventHref(e.slug)} className="font-semibold text-accent hover:underline">
                    {e.title}
                  </Link>
                  {(e.location || e.online) && (
                    <p className="text-sm text-muted">
                      {e.location}
                      {e.online && (e.location ? " · ook online" : "online")}
                    </p>
                  )}
                  {showSummary && eventSummary(e) && <p className="mt-1 text-[15px] leading-relaxed">{eventSummary(e)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
