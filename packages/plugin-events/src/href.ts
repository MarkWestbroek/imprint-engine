/** Pure agenda helpers (no store imports: usable in client, server and Node scripts). */

/** The URL space the plugin claims: `/events` (the agenda) and `/events/<slug>`. */
export const EVENTS_PREFIX = "events";

export const eventsHref = () => `/${EVENTS_PREFIX}`;
export const eventHref = (slug: string) => `/${EVENTS_PREFIX}/${slug}`;

/** Title → slug: lower case, diacritics off, the rest to hyphens. */
export function eventSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  );
}

const TZ = "Europe/Amsterdam";

/**
 * A local time as typed in a form (`2026-11-30T15:00`) with the zone's offset
 * of that day (`2026-11-30T15:00+01:00`); the events are held in Dutch time.
 */
export function withZone(local: string, timeZone = TZ): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return local;
  const asUtc = new Date(`${local}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return local;
  const name = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" }).formatToParts(asUtc).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const offset = /GMT([+-]\d{2}:\d{2})/.exec(name)?.[1] ?? "+00:00";
  return `${local}${offset}`;
}

/** "maandag 30 november 2026" */
export function formatDay(iso: string, locale = "nl-NL"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
}

/** "15:00" */
export function formatTime(iso: string, locale = "nl-NL"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/** "maandag 30 november 2026, 15:00–16:00" (or across days: "… 15:00 – dinsdag 1 december 2026, 12:00"). */
export function formatWhen(start: string, end?: string, locale = "nl-NL"): string {
  const from = `${formatDay(start, locale)}, ${formatTime(start, locale)}`;
  if (!end) return from;
  const sameDay = formatDay(start, locale) === formatDay(end, locale);
  return sameDay ? `${from}–${formatTime(end, locale)}` : `${from} – ${formatDay(end, locale)}, ${formatTime(end, locale)}`;
}

/** "november 2026", for grouping an agenda by month. */
export function formatMonth(iso: string, locale = "nl-NL"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: TZ });
}

/** Over when its end (or, without one, its start) has passed. */
export function isPast(event: { start: string; end: string }, now = new Date()): boolean {
  const last = new Date(event.end || event.start);
  return !Number.isNaN(last.getTime()) && last.getTime() < now.getTime();
}

/** The list text without Markdown, cut at a word. */
export function eventSummary(event: { summary: string; body: string }, max = 200): string {
  const text = (event.summary || event.body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\\([\\`*_[\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}
