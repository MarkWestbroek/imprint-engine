import Link from "next/link";
import type { Menu } from "@imprint/content-core";
import { FooterLinks } from "@/components/footer-links";
import { NavLinks } from "@/components/nav-links";
import { TAAL } from "../../imprint.config";

/**
 * The chrome of the language training: the name of the site (from the site
 * config), the "main" menu from the store, and the choice of interface
 * language. Deliberately small: a lesson is read on a phone.
 */

export type NavItem = { href: string; label: string };

type MenuItem = Menu["items"][number];
const hrefOf = (item: MenuItem) => (item.page !== undefined ? `/${item.page === "home" ? "" : item.page}` : (item.url ?? "/"));

export function menuToNav(menu: Menu | null): NavItem[] {
  return (menu?.items ?? []).map((item) => ({ href: hrefOf(item), label: item.label }));
}

export function SiteHeader({ nav, name, tagline }: { nav: NavItem[]; name: string; tagline: string }) {
  return (
    <header className="tl-header">
      <div className="tl-container tl-header-row">
        <Link className="tl-brand" href="/">
          <span lang="nl">{name}</span>
          <small>{tagline}</small>
        </Link>
        <nav aria-label="Menu" className="tl-nav">
          <NavLinks nav={nav} ui={TAAL.ui} standaardUi={TAAL.standaardUi} />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="tl-footer">
      <div className="tl-container">
        <p>
          <span lang="nl">Langzaam maar zeker</span> · powoli, ale do przodu · <a href="https://imprint-engine.nl">Imprint</a>
        </p>
        <FooterLinks />
      </div>
    </footer>
  );
}
