import Link from "next/link";
import type { AdminContext } from "@imprint/runtime-admin";
import { attendees } from "./actions";
import { getEvent } from "./events";
import { eventHref, formatWhen } from "./href";

const LABEL: Record<string, string> = { attending: "komt", maybe: "misschien", not: "komt niet" };

/**
 * `/events/<slug>/attendees`: who signed up, for the organiser (the site's
 * staff, or the managers of the event's group). A dynamic page the site
 * renders per request; null when the visitor may not see it. The addresses
 * are shown because the members agreed to that when signing up.
 */
export async function EventAttendeesScreen({ admin, slug }: { admin: AdminContext; slug: string }) {
  const store = admin.imprint.writableStore;
  const event = store ? await getEvent(store, slug) : null;
  const list = event ? await attendees(admin, slug) : null;
  if (!event || !list) return null;
  const coming = list.filter((a) => a.status !== "not");
  const addresses = coming.map((a) => a.email).filter((e): e is string => !!e);
  return (
    <article>
      <Link href={eventHref(slug)} className="text-sm text-muted hover:underline">
        ← {event.title}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Aanmeldingen: {event.title}</h1>
      <p className="mt-1 text-muted">{formatWhen(event.start, event.end)}</p>
      <p className="mt-4 text-sm">
        {list.filter((a) => a.status === "attending").length} komen · {list.filter((a) => a.status === "maybe").length} misschien ·{" "}
        {list.filter((a) => a.status === "not").length} komen niet
        {event.maxAttendees !== undefined && ` · maximaal ${event.maxAttendees}`}
      </p>
      {addresses.length > 0 && (
        <p className="mt-3">
          <a
            href={`mailto:?bcc=${encodeURIComponent(addresses.join(","))}&subject=${encodeURIComponent(event.title)}`}
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong"
          >
            Mail iedereen die (misschien) komt ({addresses.length})
          </a>
        </p>
      )}
      <ul className="mt-6 divide-y divide-line rounded-md border border-line">
        {list.map((a) => (
          <li key={a.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-semibold">{a.name}</span>
              {a.email && <span className="ml-2 text-sm text-muted">{a.email}</span>}
            </span>
            <span className="text-sm">
              {LABEL[a.status] ?? a.status}
              <span className="ml-2 text-muted">sinds {a.since}</span>
            </span>
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nog geen aanmeldingen.</li>}
      </ul>
      <p className="mt-4 text-xs text-muted">
        De leden gaven bij het aanmelden toestemming dat de organisatie naam en e-mailadres ziet voor dit evenement. Gebruik ze
        alleen daarvoor.
      </p>
    </article>
  );
}
