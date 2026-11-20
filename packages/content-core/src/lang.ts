import type { ContentStore, ContentType, ReadOptions } from "./store";

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
 * language and a read picks one. Every other type (theme, asset, the plugins'
 * types) has no language of its own; its rows keep the label "en" unless the
 * type's own code passes another.
 */
export const LANGUAGE_TYPES: readonly ContentType[] = ["page", "product", "component", "board-spec", "menu"];

/**
 * Whether rows labelled "en" may stand in for the base language: only on a
 * site that does not have English as one of its languages. There an "en" row
 * can only be from before the site had a base language; on a site with
 * English it is a translation, and must not show up as Dutch.
 */
export function legacyFallback(locales: readonly string[] | undefined, defaultLocale: string = LEGACY_LOCALE): boolean {
  return defaultLocale !== LEGACY_LOCALE && !(locales ?? []).includes(LEGACY_LOCALE);
}

/** The language an item of `type` is read and written in when none is given. */
export function itemLang(type: ContentType, defaultLocale: string = LEGACY_LOCALE): string {
  return LANGUAGE_TYPES.includes(type) ? defaultLocale : LEGACY_LOCALE;
}

/**
 * One item per slug: the wanted language, else the site's base language, else
 * (`legacy`, default on) "en": rows from before the site had a base language.
 * With `exact` only the wanted language counts: an item without a translation
 * is not there (the `/en/…` side of a site, `hreflang`).
 */
export function pickByLang<T extends { slug: string; lang: string }>(
  items: T[],
  wanted: string | undefined,
  defaultLocale: string = LEGACY_LOCALE,
  opts: { exact?: boolean; legacy?: boolean } = {}
): T[] {
  const want = wanted ?? defaultLocale;
  const chain = opts.exact ? [want] : [...(opts.legacy === false ? [] : [LEGACY_LOCALE]), defaultLocale, want];
  const bySlug = new Map<string, T>();
  for (const lang of new Set(chain)) {
    for (const item of items) if (item.lang === lang) bySlug.set(item.slug, item);
  }
  return [...bySlug.values()];
}

/* ---------- more languages side by side (layer 4) ---------- */

/** What a site's languages come down to for an address: the list and the base. */
export type SiteLocales = { locales: readonly string[]; defaultLocale: string };

/**
 * The language of an address and the rest of it. The base language has no
 * prefix (existing addresses keep working); another language of the site is
 * the first segment: `/en/about` → en + about, `/about` → base + about.
 */
export function splitLocalePath(segments: readonly string[], site: SiteLocales): { locale: string; segments: string[] } {
  const [first, ...rest] = segments;
  if (first && first !== site.defaultLocale && site.locales.includes(first)) return { locale: first, segments: rest };
  return { locale: site.defaultLocale, segments: [...segments] };
}

/** The address of `path` ("/", "/about", "about") in `locale`: "/about" in the base language, "/en/about" in another. */
export function localeHref(locale: string, path: string, defaultLocale: string): string {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (locale === defaultLocale) return `/${clean}`;
  return clean ? `/${locale}/${clean}` : `/${locale}`;
}

/** The read options for a page in `locale`: the base language reads as always, another language only what is translated. */
export function localeReadOptions(locale: string, defaultLocale: string, opts: ReadOptions = {}): ReadOptions {
  return locale === defaultLocale ? { ...opts, lang: locale } : { ...opts, lang: locale, exactLang: true };
}

/**
 * The languages in which the page `slug` exists, in the order of the site's
 * languages, each with its address. For the language choice in the header and
 * for `hreflang`: only translations that are there.
 */
export async function pageTranslations(
  store: Pick<ContentStore, "getPage">,
  slug: string,
  site: SiteLocales,
  opts: ReadOptions = {}
): Promise<{ locale: string; href: string }[]> {
  const found: { locale: string; href: string }[] = [];
  for (const locale of site.locales) {
    const page = await store.getPage(slug, localeReadOptions(locale, site.defaultLocale, opts));
    if (page) found.push({ locale, href: localeHref(locale, slug === "home" ? "" : slug, site.defaultLocale) });
  }
  return found;
}

/**
 * The slugs of the pages each language has. For a language choice that sits
 * in a layout: the layout does not know the page, so a client part gets this
 * list and looks the current address up in it (`LanguageSwitchClient`).
 */
export async function pageSlugsByLocale(
  store: Pick<ContentStore, "listPages">,
  site: SiteLocales,
  opts: ReadOptions = {}
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const locale of site.locales) {
    out[locale] = (await store.listPages(localeReadOptions(locale, site.defaultLocale, opts))).map((p) => p.slug);
  }
  return out;
}

/** The translations of one page out of `pageSlugsByLocale`: the same answer as `pageTranslations`, without the store. */
export function translationsFromSlugs(
  slugs: Readonly<Record<string, readonly string[]>>,
  slug: string,
  site: SiteLocales
): { locale: string; href: string }[] {
  return site.locales
    .filter((locale) => slugs[locale]?.includes(slug))
    .map((locale) => ({ locale, href: localeHref(locale, slug === "home" ? "" : slug, site.defaultLocale) }));
}

/**
 * The language choice for a page: every language of the site, with the
 * address of the translation where there is one and the start page of that
 * language where there is none (`translated: false`, so the site can show it
 * differently).
 */
export function languageLinks(
  translations: readonly { locale: string; href: string }[],
  site: SiteLocales
): { locale: string; href: string; translated: boolean }[] {
  return site.locales.map((locale) => {
    const found = translations.find((t) => t.locale === locale);
    return { locale, href: found?.href ?? localeHref(locale, "", site.defaultLocale), translated: !!found };
  });
}

/**
 * `alternates` for a page's metadata (Next's `Metadata.alternates`): the
 * canonical address in this language and one `hreflang` per translation, plus
 * `x-default` on the base language. With `baseUrl` the addresses are absolute,
 * as search engines want them. Empty `languages` when the page exists in one
 * language only.
 */
export function hreflangAlternates(
  translations: readonly { locale: string; href: string }[],
  locale: string,
  site: SiteLocales,
  baseUrl = ""
): { canonical?: string; languages: Record<string, string> } {
  const abs = (href: string) => `${baseUrl.replace(/\/+$/, "")}${href}`;
  const languages: Record<string, string> = {};
  if (translations.length > 1) {
    for (const t of translations) languages[t.locale] = abs(t.href);
    const base = translations.find((t) => t.locale === site.defaultLocale);
    if (base) languages["x-default"] = abs(base.href);
  }
  const own = translations.find((t) => t.locale === locale);
  return { canonical: own ? abs(own.href) : undefined, languages };
}

/** A site config with its name, tagline and motto in `locale`, where the config has them (`translations`). */
export function localizedSite<T extends { translations?: Record<string, { name?: string; tagline?: string; motto?: string }> }>(
  site: T,
  locale: string
): T {
  const t = site.translations?.[locale];
  if (!t) return site;
  const given = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined && v !== ""));
  return { ...site, ...given };
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
