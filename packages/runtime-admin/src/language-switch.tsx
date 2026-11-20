import Link from "next/link";
import { messagesFor } from "@imprint/content-core/messages"; // the subpath: this file is also used from a client part
import { publicMessages } from "./messages";

/** A language in its own words: "Nederlands", "English", "Polski". */
export function languageName(locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return locale;
  }
}

/**
 * The language choice for the header (design/meertaligheid.md layer 4): one
 * link per language of the site, from `languageLinks` (content-core). The
 * current language is marked, not linked; a language in which this page has
 * no translation links to that language's start page and carries
 * `data-untranslated`, so a site can style it. Renders nothing on a site with
 * one language. Plain links, no cookie: every language has its own address.
 */
export function LanguageSwitch({
  links,
  current,
  className,
}: {
  links: readonly { locale: string; href: string; translated: boolean }[];
  /** The language of the page being shown. */
  current: string;
  className?: string;
}) {
  if (links.length < 2) return null;
  return (
    <nav aria-label={messagesFor(publicMessages, current).language} className={className}>
      <ul className="flex items-center gap-3 text-sm">
        {links.map((l) => (
          <li key={l.locale}>
            {l.locale === current ? (
              <span aria-current="true" lang={l.locale} className="font-semibold">
                {languageName(l.locale)}
              </span>
            ) : (
              <Link
                href={l.href}
                hrefLang={l.locale}
                lang={l.locale}
                data-untranslated={l.translated ? undefined : ""}
                className="text-muted hover:text-accent"
              >
                {languageName(l.locale)}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
