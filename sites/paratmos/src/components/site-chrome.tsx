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

export function SiteHeader({ nav }: { nav: NavItem[] }) {
  return (
    <header className="pm-header">
      <div className="pm-container pm-header-row">
        <Link href="/" aria-label="Paratmos, naar home" className="pm-logo">
          <Beeldmerk />
          <span className="pm-logo-naam">paratmos</span>
        </Link>
        <nav aria-label="Hoofdmenu" className="pm-nav pm-mono">
          <NavLinks nav={nav} />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="pm-footer pm-mono">
      <div className="pm-container pm-footer-row">
        <span>Paratmos · IT voorbij aan het verkopen van lucht</span>
        <span className="pm-footer-links">
          <Link href="/search">Zoeken</Link>
          <Link href="/contact">Contact</Link>
          <a href="https://www.linkedin.com/in/markwestbroek/" rel="me noopener">
            LinkedIn
          </a>
          <a href="https://imprint-engine.nl">Gemaakt met Imprint</a>
        </span>
      </div>
    </footer>
  );
}
