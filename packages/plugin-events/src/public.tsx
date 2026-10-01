import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject } from "@imprint/content-core";
import { Markdown, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { EventList } from "./event-list";
import { getEvent, listEvents } from "./events";
import { EVENTS_PREFIX, eventSummary, eventsHref, formatWhen, isPast } from "./href";
import type { Event } from "./schemas";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-semibold">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function EventView({ event }: { event: Event }) {
  const over = isPast(event);
  return (
    <article className="max-w-3xl">
      <Link href={eventsHref()} className="text-sm text-muted hover:underline">
        ← Agenda
      </Link>
      <p className="mt-4 text-xs text-muted">
        Evenement{over && " · geweest"}
        {event.group && (
          <>
            {" · "}
            <Link href={`/groups/${event.group}`} className="hover:underline">
              community
            </Link>
          </>
        )}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-md border border-line bg-surface p-5 text-[15px]">
        <Row label="Wanneer">
          <time dateTime={event.start}>{formatWhen(event.start, event.end)}</time>
          {event.repeat && <span className="block text-muted">{event.repeat}</span>}
        </Row>
        {(event.location || event.address || event.online) && (
          <Row label="Waar">
            {event.locationLink ? (
              <a href={event.locationLink} className="text-accent underline" target="_blank" rel="noopener noreferrer">
                {event.location || event.address || "locatie"}
              </a>
            ) : (
              event.location
            )}
            {event.address && event.address !== event.location && <span className="block text-muted">{event.address}</span>}
            {event.online && <span className="block text-muted">Ook online bij te wonen</span>}
          </Row>
        )}
        {event.organizer && <Row label="Organisatie">{event.organizer}</Row>}
        {event.rsvp && (
          <Row label="Aanmelden">
            {event.maxAttendees ? `Maximaal ${event.maxAttendees} deelnemers · ` : ""}
            <span className="text-muted">aanmelden komt met de volgende stap</span>
          </Row>
        )}
        {(event.externalLink || event.ticketLink) && (
          <Row label="Links">
            {event.externalLink && (
              <a href={event.externalLink} className="text-accent underline" target="_blank" rel="noopener noreferrer">
                Meer informatie
              </a>
            )}
            {event.externalLink && event.ticketLink && " · "}
            {event.ticketLink && (
              <a href={event.ticketLink} className="text-accent underline" target="_blank" rel="noopener noreferrer">
                Tickets
              </a>
            )}
          </Row>
        )}
      </dl>
      {event.image && (
        // eslint-disable-next-line @next/next/no-img-element -- remote or library image, sized by CSS
        <img src={event.image} alt="" className="mt-6 max-h-96 w-full rounded-md object-cover" />
      )}
      <div className="markdown mt-6">
        <Markdown>{event.body || event.summary}</Markdown>
      </div>
      {event.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
          {event.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-3 py-0.5 text-sm text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * `/events`: the agenda (upcoming by month, then the most recent past ones);
 * `/events/<slug>`: one event. A non-public event goes to /members, where
 * the PDP decides for the subject at hand.
 */
export async function eventsPublicRoute({ imprint, slug, members, session, subject: given }: PublicRouteContext): Promise<PublicRouteResult | null> {
  if (slug[0] !== EVENTS_PREFIX || slug.length > 2) return null;
  const subject = given ?? (session ? userSubject(session.name, session.role) : ANONYMOUS);
  const store = members ? imprint.storeFor(subject) : imprint.store;
  if (slug.length === 1) {
    const [upcoming, past] = await Promise.all([listEvents(store, { when: "upcoming" }), listEvents(store, { when: "past" })]);
    return {
      render: (
        <section>
          <h1 className="mb-6 text-3xl font-semibold tracking-tight">Agenda</h1>
          <EventList events={upcoming} showSummary />
          {past.length > 0 && (
            <details className="mt-10">
              <summary className="cursor-pointer text-lg font-semibold">Eerder ({past.length})</summary>
              <div className="mt-4">
                <EventList events={past.slice(0, 60)} />
              </div>
            </details>
          )}
        </section>
      ),
      metadata: { title: "Agenda" },
    };
  }
  const raw = imprint.writableStore ? await getEvent(imprint.writableStore, slug[1]!) : null;
  if (!raw) return null;
  if (raw.access !== "public") {
    if (!members) return { redirect: `/members/${slug.join("/")}` };
    if (!(await permit(imprint.pdp, subject, "read", contentResource("event", raw.slug, raw)))) return null;
  }
  return { render: <EventView event={raw} />, metadata: { title: raw.title, description: eventSummary(raw, 160) } };
}
