"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountPad, accountTeksten, uiVan } from "@/lib/account-teksten";

/** Contact and privacy, in the language of the page you are on. */
export function FooterLinks() {
  const ui = uiVan(usePathname().split("/")[1]);
  const t = accountTeksten(ui);
  return (
    <p className="mt-2 flex gap-4">
      <Link href={`/${ui}/kontakt`}>{t.kontakt.titel}</Link>
      <Link href={accountPad(ui, "privacy")}>{t.privacy}</Link>
    </p>
  );
}
