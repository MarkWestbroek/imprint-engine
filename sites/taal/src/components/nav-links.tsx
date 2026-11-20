"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountLink } from "@/components/account-link";
import type { NavItem } from "@/components/site-chrome";
import { ingangVan, STANDAARD_UI } from "@/lib/ingang";

/**
 * The interface language of the page you are on: the first segment of the
 * address (`/pl/…`, `/en/…`). A page from the store has no language in its
 * address (`/about-the-method`); it belongs to the entrance whose menu links
 * to it, else to the default.
 */
export function useUi(ui: string[], menus: Record<string, NavItem[]>): { current: string | null; lezer: string } {
  const path = usePathname();
  const first = path.split("/")[1];
  const current = first && ui.includes(first) ? first : null;
  const viaMenu = Object.entries(menus).find(([, nav]) => path !== "/" && nav.some((i) => i.href === path))?.[0];
  return { current, lezer: current ?? viaMenu ?? STANDAARD_UI };
}

/**
 * The header: the name of the site, the menu of your entrance with the item
 * you are in marked, the account, and the choice of interface language.
 * Switching language keeps you on the same lesson; from a page of the store
 * it leads to the front page of that language.
 */
export function HeaderRow({ menus, name, tagline, ui }: { menus: Record<string, NavItem[]>; name: string; tagline: string; ui: string[] }) {
  const path = usePathname();
  const { current, lezer } = useUi(ui, menus);
  const ingang = ingangVan(lezer);
  const nav = menus[ingang.ui] ?? [];
  const [, , ...rest] = path.split("/");
  const binnen = (href: string) => href !== "/" && (path === href || path.startsWith(`${href}/`));
  // Only the deepest item you are in: in /pl/nederlands/grammatica that is "Gramatyka", not "Lekcje" too.
  const diepste = nav.map((i) => i.href).filter(binnen).sort((a, b) => b.length - a.length)[0];
  const inside = (href: string) => href === diepste;
  // From a front page or a page of the store: to the front page of the other language.
  const wissel = (code: string) => (current && rest.length > 0 ? `/${[code, ...rest].join("/")}` : ingangVan(code).ui === code ? ingangVan(code).start : `/${code}`);
  return (
    <>
      <Link className="tl-brand" href={ingang.start}>
        <span lang="nl">{name}</span>
        <small lang={ingang.ui}>{ingang.tagline ?? tagline}</small>
      </Link>
      <nav aria-label="Menu" className="tl-nav" lang={ingang.ui}>
        {nav.map((item) => (
          <Link key={item.href} href={item.href} aria-current={inside(item.href) ? "page" : undefined} className={inside(item.href) ? "is-active" : undefined}>
            {item.label}
          </Link>
        ))}
        <AccountLink ui={lezer} />
        <span className="tl-lang">
          {ui.map((code) => (
            <Link key={code} href={wissel(code)} hrefLang={code} aria-current={lezer === code ? "true" : undefined}>
              {code.toUpperCase()}
            </Link>
          ))}
        </span>
      </nav>
    </>
  );
}
