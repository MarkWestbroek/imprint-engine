"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountLink } from "@/components/account-link";
import type { NavItem } from "@/components/site-chrome";

/**
 * The menu items with the one you are in marked, and the interface language:
 * the first segment of the address (`/pl/…`, `/nl/…`). Switching keeps you on
 * the same lesson. Pages from the store have no language in their address,
 * so there the switch leads to the lessons.
 */
export function NavLinks({ nav, ui, standaardUi }: { nav: NavItem[]; ui: string[]; standaardUi: string }) {
  const path = usePathname();
  const [, first, ...rest] = path.split("/");
  const current = first && ui.includes(first) ? first : null;
  const inside = (href: string) => href !== "/" && (path === href || path.startsWith(`${href}/`));
  return (
    <>
      {nav.map((item) => (
        <Link key={item.href} href={item.href} aria-current={inside(item.href) ? "page" : undefined} className={inside(item.href) ? "is-active" : undefined}>
          {item.label}
        </Link>
      ))}
      <AccountLink ui={current ?? standaardUi} />
      <span className="tl-lang">
        {ui.map((code) => (
          <Link
            key={code}
            href={current ? `/${[code, ...rest].join("/")}` : `/${code}`}
            hrefLang={code}
            aria-current={(current ?? standaardUi) === code ? "true" : undefined}
          >
            {code.toUpperCase()}
          </Link>
        ))}
      </span>
    </>
  );
}
