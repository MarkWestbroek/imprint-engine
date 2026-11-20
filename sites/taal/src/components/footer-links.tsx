"use client";

import Link from "next/link";
import { useUi } from "@/components/nav-links";
import type { NavItem } from "@/components/site-chrome";
import { accountPad, accountTeksten } from "@/lib/account-teksten";
import { ingangVan } from "@/lib/ingang";

/** The name with its translation, then contact and privacy, in the language of the page you are on. */
export function FooterLinks({ tagline, menus, talen }: { tagline: string; menus: Record<string, NavItem[]>; talen: string[] }) {
  const ui = useUi(talen, menus).lezer;
  const t = accountTeksten(ui);
  return (
    <>
      <p>
        <span lang="nl">Langzaam maar zeker</span> · {ingangVan(ui).tagline ?? tagline} · <a href="https://imprint-engine.nl">Imprint</a>
      </p>
      <p className="mt-2 flex gap-4">
        <Link href={`/${ui}/kontakt`}>{t.kontakt.titel}</Link>
        <Link href={accountPad(ui, "privacy")}>{t.privacy}</Link>
      </p>
    </>
  );
}
