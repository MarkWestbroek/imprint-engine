import Link from "next/link";
import type { Menu } from "@imprint/content-core";
import { NavLinks } from "@/components/nav-links";

/**
 * The chrome of markwestbroek.nl: the address on the left, the "main" menu
 * from the store (edited in the admin) on the right, and a one-line footer.
 * Mono capitals, like the lettering on a module panel.
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

export function SiteHeader({ nav }: { nav: NavItem[] }) {
  return (
    <header className="mw-mono">
      <div className="mw-container mw-header-row">
        <Link href="/" aria-label="Mark Westbroek, naar home">
          markwestbroek.nl
        </Link>
        <nav aria-label="Hoofdmenu" className="mw-nav">
          <NavLinks nav={nav} />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mw-footer mw-mono">
      <div className="mw-container mw-footer-row">
        <span>Mark Westbroek</span>
        <span>
          Gemaakt met <a href="https://imprint-engine.nl">Imprint</a>
        </span>
      </div>
    </footer>
  );
}
