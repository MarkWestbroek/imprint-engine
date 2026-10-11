"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/site-chrome";

/**
 * The menu items, with the one you are in marked: its own page or one of the
 * pages under it in the menu (Canoniek model sits under Modelleren).
 */
export function NavLinks({ nav }: { nav: NavItem[] }) {
  const path = usePathname();
  const inside = (href: string) => href !== "/" && (path === href || path.startsWith(`${href}/`));
  return (
    <>
      {nav.map((item) => {
        const active = inside(item.href) || item.children.some(inside);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "is-active" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
