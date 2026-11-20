import type { Metadata } from "next";
import { hreflangAlternates, localeHref, localeReadOptions, localizedSite, pageTranslations, type ReadOptions } from "@imprint/content-core";
import { languageName, readOpts } from "@imprint/runtime-admin";
import { imprint, store } from "@/lib/content";

/**
 * The languages of paratmos.nl (design/meertaligheid.md, layer 4): Dutch is
 * the base language without a prefix, English lives under /en with the same
 * slugs. Pages only; the blog, the knowledge base and the glossary are Dutch.
 */
export const SITE = { locales: imprint.locales, defaultLocale: imprint.defaultLocale };

/** "/en" for English, nothing for the base language (WidgetContext.pathPrefix). */
export const pathPrefix = (locale: string) => (locale === SITE.defaultLocale ? undefined : `/${locale}`);

/** The address of a page slug in a language: "home" is the start page of that language. */
export const pageHref = (locale: string, slug: string) => localeHref(locale, slug === "home" ? "" : slug, SITE.defaultLocale);

/** Read options for a page in `locale`, with the admin's preview: another language reads only what is translated. */
export async function pageReadOptions(locale: string): Promise<ReadOptions> {
  return localeReadOptions(locale, SITE.defaultLocale, await readOpts());
}

/** Title, description and the hreflang alternates of a page in `locale`. */
export async function pageMetadata(slug: string, locale: string): Promise<Metadata> {
  const page = await store.getPage(slug, localeReadOptions(locale, SITE.defaultLocale));
  if (!page) return {};
  const site = await store.getSiteConfig();
  const translations = await pageTranslations(store, slug, SITE);
  return {
    ...(slug === "home" ? {} : { title: page.title }),
    description: page.description || localizedSite(site, locale).motto,
    alternates: hreflangAlternates(translations, locale, SITE, site.baseUrl),
  };
}

/** The languages for the language choice: code and name in its own words. */
export const LANGUAGES = SITE.locales.map((locale) => ({ locale, name: languageName(locale) }));

/**
 * Per language, the slugs of the pages that exist in it. The language choice
 * in the header (a client component, so the layouts stay static) uses this to
 * link to the translation of the page you are on, or to the start page of the
 * other language where there is none.
 */
export async function pagesPerLanguage(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const locale of SITE.locales) {
    out[locale] = (await store.listPages(localeReadOptions(locale, SITE.defaultLocale))).map((p) => p.slug);
  }
  return out;
}
