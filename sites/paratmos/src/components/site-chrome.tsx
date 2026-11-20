import Link from "next/link";
import type { Menu } from "@imprint/content-core";
import { NavLinks } from "@/components/nav-links";

/**
 * The chrome of paratmos.nl: the name on the left, the "main" menu from the
 * store (edited in the admin) on the right, and a footer with the company
 * line. The logo is the primary lockup of the brand guidelines: the mark and the
 * word mark in lower case (the files are in public/brand).
 */

/** A menu item; `children` are the pages under it (not shown, but they mark it as the one you are in). */
export type NavItem = { href: string; label: string; children: string[] };

type MenuItem = Menu["items"][number];
const hrefOf = (item: MenuItem) => (item.page !== undefined ? `/${item.page === "home" ? "" : item.page}` : (item.url ?? "/"));

export function menuToNav(menu: Menu | null): NavItem[] {
  return (menu?.items ?? []).map((item) => ({
    href: hrefOf(item),
    label: item.label,
    children: (item.children ?? []).map(hrefOf),
  }));
}

/** The mark "Doorbraak", as in public/brand/paratmos-icoon.svg; the grounded part takes the text colour. */
function Beeldmerk() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M 14 64 A 69.8 69.8 0 0 1 86 64" fill="none" stroke="#6FB7DD" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M 40 82 L 56.6 54.3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M 56.6 54.3 L 76 22" fill="none" stroke="#2E8FC7" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="82" r="2.4" fill="currentColor" />
      <circle cx="76" cy="22" r="4.6" fill="#2E8FC7" />
    </svg>
  );
}

/** The words of the header and footer per language (the site's own fixed texts). */
const TEKSTEN = {
  nl: { home: "Paratmos, naar home", menu: "Hoofdmenu", taal: "Taal", regel: "Paratmos · IT voorbij aan het verkopen van lucht", zoeken: "Zoeken", gemaakt: "Gemaakt met Imprint" },
  en: { home: "Paratmos, to the home page", menu: "Main menu", taal: "Language", regel: "Paratmos · IT beyond selling hot air", zoeken: "Search (in Dutch)", gemaakt: "Made with Imprint" },
} as const;
const tekstenVoor = (locale: string) => TEKSTEN[locale === "en" ? "en" : "nl"];

/** The label of the language choice, for the layouts. */
export const languageLabel = (locale: string) => tekstenVoor(locale).taal;

/**
 * The header: the logo (to the start page of this language), the menu of this
 * language, and the language choice (handed in, so the studio can leave it out).
 */
export function SiteHeader({ nav, locale = "nl", languages }: { nav: NavItem[]; locale?: string; languages?: React.ReactNode }) {
  const t = tekstenVoor(locale);
  return (
    <header className="pm-header">
      <div className="pm-container pm-header-row">
        <Link href={locale === "nl" ? "/" : `/${locale}`} aria-label={t.home} className="pm-logo">
          <Beeldmerk />
          <span className="pm-logo-naam">paratmos</span>
        </Link>
        <div className="pm-header-right">
          <nav aria-label={t.menu} className="pm-nav pm-mono">
            <NavLinks nav={nav} />
          </nav>
          {languages}
        </div>
      </div>
    </header>
  );
}

/** The footer. Search covers the Dutch content only, so the English side says so. */
export function SiteFooter({ locale = "nl" }: { locale?: string }) {
  const t = tekstenVoor(locale);
  return (
    <footer className="pm-footer pm-mono">
      <div className="pm-container pm-footer-row">
        <span>{t.regel}</span>
        <span className="pm-footer-links">
          <Link href="/search">{t.zoeken}</Link>
          <Link href={locale === "nl" ? "/contact" : `/${locale}/contact`}>Contact</Link>
          <a href="https://www.linkedin.com/in/markwestbroek/" rel="me noopener">
            LinkedIn
          </a>
          <a href="https://imprint-engine.nl">{t.gemaakt}</a>
        </span>
      </div>
    </footer>
  );
}
