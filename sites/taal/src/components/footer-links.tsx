"use client";

import Link from "next/link";
import { useIngang } from "@/components/nav-links";
import { accountPad, accountTeksten } from "@/lib/account-teksten";
import type { NavItem } from "@/lib/ingang";

/** The name of the course with its translation, then contact and privacy, in the language of the page you are on. */
export function FooterLinks({ name, tagline, menus, talen }: { name: string; tagline: string; menus: Record<string, NavItem[]>; talen: string[] }) {
  const { ingang, lezer } = useIngang(talen, menus);
  const t = accountTeksten(lezer);
  return (
    <>
      <p>
        <span lang={ingang.pakket}>{ingang.naam ?? name}</span> · {ingang.tagline ?? tagline} · <a href="https://imprint-engine.nl">Imprint</a>
      </p>
      <p className="mt-2 flex gap-4">
        <Link href={`/${lezer}/kontakt`}>{t.kontakt.titel}</Link>
        <Link href={accountPad(lezer, "privacy")}>{t.privacy}</Link>
      </p>
    </>
  );
}
