import { LEGACY_LOCALE } from "./lang";

/**
 * Fixed texts and dates in the language of the site (W5/S9,
 * design/meertaligheid.md layer 2). No i18n library: a package that shows
 * text keeps one object per language with the same keys (`src/messages.ts`),
 * and picks one with `messagesFor`. Pure, so it works on the server, in a
 * client part and in a test alike.
 *
 *   const messages = { en: { next: "Next" }, nl: { next: "Volgende" } } satisfies Catalog<{ next: string }>;
 *   const t = messagesFor(messages, ctx.locale);
 *
 * The type of the English entry is the contract: a language that misses a key
 * does not compile.
 */

/** One object of texts per language; English is always there, as the fallback. */
export type Catalog<T> = { en: T } & Partial<Record<string, T>>;

/** The texts in `locale`, else the English ones. */
export function messagesFor<T>(catalog: Catalog<T>, locale: string = LEGACY_LOCALE): T {
  return catalog[locale] ?? catalog.en;
}

/** The languages a catalogue has (for the test that all of them have every key). */
export function catalogLocales(catalog: Catalog<unknown>): string[] {
  return Object.keys(catalog);
}

/** `date`: a day in words ("20 november 2026"); `short`: in digits; `datetime`: day and time. */
export type DateStyle = "date" | "short" | "datetime";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date in the language of the site. A plain day ("2026-11-20") is that day
 * everywhere: it is not shifted by a time zone. A moment (a Date or a full
 * ISO string) is shown in `timeZone`. An unreadable value comes back as it is.
 */
export function formatDate(
  locale: string,
  value: string | Date,
  style: DateStyle = "date",
  timeZone = "Europe/Amsterdam"
): string {
  const day = typeof value === "string" ? DAY_RE.exec(value) : null;
  const date = day ? new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const zone = day ? "UTC" : timeZone;
  if (style === "short") return date.toLocaleDateString(locale, { timeZone: zone });
  if (style === "datetime") return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: zone });
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: zone });
}
