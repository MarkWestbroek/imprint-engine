import Link from "next/link";
import { Menu as MenuIcon } from "lucide-react";
import type { Menu } from "@imprint/content-core";
import { NavLinks } from "@/components/nav-links";

/**
 * The Inrichting chrome: a sober workplace header (name, the "main" menu from
 * the store, a link to Beheer) and a footer that says where the data comes
 * from. Neutral colours, no government house style.
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

export function SiteHeader({ nav, user }: { nav: NavItem[]; user?: string }) {
  return (
    <header className="ir-header">
      <div className="ir-container ir-header-row">
        <Link className="ir-brand" href="/" aria-label="Inrichting, naar het overzicht">
          <span className="ir-mark" aria-hidden="true" />
          <span>Inrichting</span>
        </Link>
        <nav aria-label="Hoofdmenu" className="ir-nav">
          <NavLinks nav={nav} />
          <Link href="/admin">{user ? `Beheer (${user})` : "Inloggen"}</Link>
        </nav>
        <details className="ir-mobile-menu">
          <summary aria-label="Menu openen">
            <MenuIcon size={22} />
          </summary>
          <div>
            <NavLinks nav={nav} />
            <Link href="/admin">{user ? "Beheer" : "Inloggen"}</Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="ir-footer">
      <div className="ir-container ir-footer-row">
        <p>
          De gegevens komen rechtstreeks uit het Omnium-register; deze site bewaart er geen kopie van. Wijzigen gebeurt in
          Omnium.
        </p>
        <p className="ir-footer-small">
          Common Ground-lab · gemaakt met <a href="https://imprint-engine.nl">Imprint</a>
        </p>
      </div>
    </footer>
  );
}
