import type { ContentType } from "./store";

/**
 * Languages (W5/S9, design/meertaligheid.md layer 1). A site has a base
 * language (`defaultLocale` in its imprint.config.ts): the language its
 * content is written in. Everything here is pure, so the file store, the
 * database stores and the admin share one rule.
 */

/** The engine's own default, and the label of every row written before sites had a base language. */
export const LEGACY_LOCALE = "en";

const LOCALE_RE = /^[a-z]{2}$/;

/** A language code as the engine stores it: two lowercase letters ("nl", "pl"). */
export const isLocale = (value: unknown): value is string => typeof value === "string" && LOCALE_RE.test(value);

/**
 * The types the store reads by language: an item of these exists once per
 * language and a read picks one. Every other type (menu, theme, asset, the
 * plugins' types) has no language of its own; its rows keep the label "en"
 * unless the type's own code passes another.
 */
export const LANGUAGE_TYPES: readonly ContentType[] = ["page", "product", "component", "board-spec"];

/** The language an item of `type` is read and written in when none is given. */
export function itemLang(type: ContentType, defaultLocale: string = LEGACY_LOCALE): string {
  return LANGUAGE_TYPES.includes(type) ? defaultLocale : LEGACY_LOCALE;
}

/**
 * One item per slug: the wanted language, else the site's base language, else
 * "en". The last step only finds rows from before the site had a base
 * language (a Dutch site whose rows are still labelled "en").
 */
export function pickByLang<T extends { slug: string; lang: string }>(
  items: T[],
  wanted: string | undefined,
  defaultLocale: string = LEGACY_LOCALE
): T[] {
  const bySlug = new Map<string, T>();
  for (const lang of new Set([LEGACY_LOCALE, defaultLocale, wanted ?? defaultLocale])) {
    for (const item of items) if (item.lang === lang) bySlug.set(item.slug, item);
  }
  return [...bySlug.values()];
}

/** The part of a writable store a relabel needs (no import of store.ts's value side). */
type RelabelStore = {
  listItems(type: ContentType): Promise<{ slug: string; lang: string; data: unknown; validFrom: Date; validTo: Date | null }[]>;
  putItem(type: ContentType, slug: string, data: unknown, opts?: { lang?: string; validFrom?: Date; validTo?: Date | null; by?: string }): Promise<void>;
  deleteItem(type: ContentType, slug: string, lang?: string): Promise<void>;
};

/**
 * Give the items of `type` that are labelled "en" the language `to` (a site
 * that got a base language; scripts/relabel-lang.ts). Each item is asserted
 * again under the new language with the same validity, then its "en" version
 * ends: history is kept, nothing is overwritten. An item that exists in `to`
 * already is skipped, so running it twice changes nothing.
 */
export async function relabelLanguage(
  store: RelabelStore,
  type: ContentType,
  to: string,
  opts: { dryRun?: boolean; by?: string } = {}
): Promise<{ relabelled: string[]; skipped: string[] }> {
  const items = await store.listItems(type);
  const inTarget = new Set(items.filter((i) => i.lang === to).map((i) => i.slug));
  const relabelled: string[] = [];
  const skipped: string[] = [];
  for (const item of items.filter((i) => i.lang === LEGACY_LOCALE)) {
    if (inTarget.has(item.slug)) {
      skipped.push(item.slug);
      continue;
    }
    relabelled.push(item.slug);
    if (opts.dryRun) continue;
    const data = item.data && typeof item.data === "object" ? { ...(item.data as Record<string, unknown>), lang: to } : item.data;
    await store.putItem(type, item.slug, data, { lang: to, validFrom: item.validFrom, validTo: item.validTo, by: opts.by });
    await store.deleteItem(type, item.slug, LEGACY_LOCALE);
  }
  return { relabelled, skipped };
}
