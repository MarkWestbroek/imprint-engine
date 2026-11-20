import type { Menu } from "@imprint/content-core";
import { HeaderRow } from "@/components/nav-links";
import { FooterLinks } from "@/components/footer-links";
import { store } from "@/lib/content";
import { INGANGEN, type NavItem } from "@/lib/ingang";
import { TAAL } from "../../imprint.config";

/**
 * The chrome of the language training: the name of the course (from the site
 * config, or the entrance's own), the menu of the entrance you are in
 * (lib/ingang.ts; each a menu from the store), and the choice of interface
 * language. Deliberately small: a lesson is read on a phone.
 */

export type { NavItem };

type MenuItem = Menu["items"][number];
const hrefOf = (item: MenuItem) => (item.page !== undefined ? `/${item.page === "home" ? "" : item.page}` : (item.url ?? "/"));

export function menuToNav(menu: Menu | null): NavItem[] {
  return (menu?.items ?? []).map((item) => ({ href: hrefOf(item), label: item.label }));
}

/** The menu of every entrance, by the name of the menu. */
export async function menus(opts?: Parameters<typeof store.getMenu>[1]): Promise<Record<string, NavItem[]>> {
  const gelezen = await Promise.all(INGANGEN.map(async (i) => [i.menu, menuToNav(await store.getMenu(i.menu, opts))] as const));
  return Object.fromEntries(gelezen);
}

export function SiteHeader({ menus, name, tagline }: { menus: Record<string, NavItem[]>; name: string; tagline: string }) {
  return (
    <header className="tl-header">
      <div className="tl-container tl-header-row">
        <HeaderRow menus={menus} name={name} tagline={tagline} ui={TAAL.ui} />
      </div>
    </header>
  );
}

export function SiteFooter({ menus, name, tagline }: { menus: Record<string, NavItem[]>; name: string; tagline: string }) {
  return (
    <footer className="tl-footer">
      <div className="tl-container">
        <FooterLinks name={name} tagline={tagline} menus={menus} talen={TAAL.ui} />
      </div>
    </footer>
  );
}
