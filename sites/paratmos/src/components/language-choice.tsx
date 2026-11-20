"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The language choice in the header: one link per language. It links to the
 * same page in the other language where that page is translated, and to the
 * start page of that language where it is not (marked `data-untranslated`).
 * The current language is marked, not linked. Plain links, no cookie.
 *
 * A client component because a layout does not know the page it wraps; the
 * server hands over which slugs exist per language (lib/locale.ts). The same
 * address rules as content-core's splitLocalePath and localeHref.
 */
export function LanguageChoice({
  languages,
  defaultLocale,
  pages,
  label,
}: {
  languages: { locale: string; name: string }[];
  defaultLocale: string;
  pages: Record<string, string[]>;
  label: string;
}) {
  const path = usePathname();
  if (languages.length < 2) return null;
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  const prefixed = segments[0] !== undefined && segments[0] !== defaultLocale && languages.some((l) => l.locale === segments[0]);
  const current = prefixed ? segments[0]! : defaultLocale;
  const slug = (prefixed ? segments.slice(1) : segments).join("/") || "home";
  const href = (locale: string, s: string) => {
    const clean = s === "home" ? "" : s;
    return locale === defaultLocale ? `/${clean}` : clean ? `/${locale}/${clean}` : `/${locale}`;
  };
  return (
    <nav aria-label={label} className="pm-lang">
      {languages.map(({ locale, name }) => {
        const translated = pages[locale]?.includes(slug) ?? false;
        return locale === current ? (
          <span key={locale} aria-current="true" lang={locale} title={name}>
            {locale.toUpperCase()}
          </span>
        ) : (
          <Link
            key={locale}
            href={href(locale, translated ? slug : "home")}
            hrefLang={locale}
            lang={locale}
            title={name}
            aria-label={name}
            data-untranslated={translated ? undefined : ""}
          >
            {locale.toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
