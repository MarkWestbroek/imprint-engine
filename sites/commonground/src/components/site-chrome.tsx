import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Menu } from "@imprint/content-core";
import { Logo } from "@/components/logo";
import { ThemeSwitcher, type ThemeChoice } from "@/components/theme-switcher";
import { UserTools } from "@/components/user-tools";

/**
 * The Common Ground chrome, after commonground.nl: logo top left, the main
 * menu next to it (items with children open as a dropdown), and search,
 * notifications and the signed-in user on the right. The menu is the "main"
 * menu from the store; the footer's content is the page `_footer`, so both
 * are edited in the admin like everything else.
 */

export type NavItem = { href?: string; label: string; children: NavItem[] };

export function menuToNav(menu: Menu | null): NavItem[] {
  const map = (items: Menu["items"]): NavItem[] =>
    items.map((item) => ({
      href: item.page !== undefined ? `/${item.page === "home" ? "" : item.page}` : item.url,
      label: item.label,
      children: map(item.children ?? []),
    }));
  return map(menu?.items ?? []);
}

function NavEntry({ item }: { item: NavItem }) {
  if (!item.children.length) {
    return <li>{item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}</li>;
  }
  return (
    <li className="has-children">
      {/* A label that is also a link keeps its link; the list opens on hover and focus. */}
      {item.href ? (
        <Link href={item.href} aria-haspopup="true">
          {item.label} <ChevronDown size={16} aria-hidden />
        </Link>
      ) : (
        <button type="button" aria-haspopup="true">
          {item.label} <ChevronDown size={16} aria-hidden />
        </button>
      )}
      <ul>
        {item.children.map((child) => (
          <NavEntry key={`${child.label}-${child.href}`} item={child} />
        ))}
      </ul>
    </li>
  );
}

export function SiteHeader({
  nav,
  themes = [],
  inert = false,
}: {
  nav: NavItem[];
  /** The themes from the store; two or more give the picker. */
  themes?: ThemeChoice[];
  inert?: boolean;
}) {
  return (
    <header className={`cg-header${inert ? " is-inert" : ""}`}>
      <div className="cg-container cg-header-row">
        <Link className="cg-logo" href="/" aria-label="Common Ground, naar home">
          <Logo />
        </Link>
        <nav aria-label="Hoofdmenu" className="cg-nav">
          <ul>
            {nav.map((item) => (
              <NavEntry key={`${item.label}-${item.href}`} item={item} />
            ))}
          </ul>
        </nav>
        <div className="cg-tools">
          {/* Stays usable in the studio's inert chrome: trying themes is what the canvas is for. */}
          <span className={inert ? "pointer-events-auto" : undefined}>
            <ThemeSwitcher themes={themes} />
          </span>
          <Link href="/search" className="cg-icon-button" aria-label="Zoeken">
            <Search size={22} aria-hidden />
          </Link>
          {!inert && <UserTools />}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="cg-footer">
      <div className="cg-container">{children}</div>
    </footer>
  );
}
