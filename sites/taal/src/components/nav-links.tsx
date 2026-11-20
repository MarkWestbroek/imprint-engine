"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountLink } from "@/components/account-link";
import { ingangVoor, wissel, type NavItem } from "@/lib/ingang";

/** The entrance of the page you are on (lib/ingang.ts), and the language of the texts around it. */
export function useIngang(ui: string[], menus: Record<string, NavItem[]>) {
  return ingangVoor(usePathname(), ui, menus);
}

/**
 * The header: the name of the course, the menu of your entrance with the
 * item you are in marked, the account, and the choice of interface language
 * (when the entrance has one). Switching language keeps you on the same
 * lesson; from a front page or a page of the store it leads to the start of
 * that language.
 */
export function HeaderRow({ menus, name, tagline, ui }: { menus: Record<string, NavItem[]>; name: string; tagline: string; ui: string[] }) {
  const path = usePathname();
  const { ingang, current, lezer } = useIngang(ui, menus);
  const nav = menus[ingang.menu] ?? [];
  const binnen = (href: string) => href !== "/" && (path === href || path.startsWith(`${href}/`));
  // Only the deepest item you are in: in /pl/nederlands/grammatica that is "Gramatyka", not "Lekcje" too.
  const diepste = nav.map((i) => i.href).filter(binnen).sort((a, b) => b.length - a.length)[0];
  const inside = (href: string) => href === diepste;
  return (
    <>
      <Link className="tl-brand" href={ingang.start}>
        <span lang={ingang.pakket}>{ingang.naam ?? name}</span>
        <small lang={ingang.ui}>{ingang.tagline ?? tagline}</small>
      </Link>
      <nav aria-label="Menu" className="tl-nav" lang={ingang.ui}>
        {nav.map((item) => (
          <Link key={item.href} href={item.href} aria-current={inside(item.href) ? "page" : undefined} className={inside(item.href) ? "is-active" : undefined}>
            {item.label}
          </Link>
        ))}
        <AccountLink ui={lezer} />
        {ingang.talen.length > 1 && (
          <span className="tl-lang">
            {ingang.talen.map((code) => (
              <Link key={code} href={wissel(path, code, ingang, current)} hrefLang={code} aria-current={lezer === code ? "true" : undefined}>
                {code.toUpperCase()}
              </Link>
            ))}
          </span>
        )}
      </nav>
    </>
  );
}
