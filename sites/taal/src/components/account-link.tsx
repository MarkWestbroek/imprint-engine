"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { accountPad, accountTeksten } from "@/lib/account-teksten";

/**
 * "Zaloguj się", or the learner's name, in the header. Who is looking is
 * asked in the browser (/api/me), again on every page: signing in and out
 * happen without a full reload.
 */
export function AccountLink({ ui }: { ui: string }) {
  const path = usePathname();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { name: string } | null) => live && setName(me?.name ?? null))
      .catch(() => live && setName(null));
    return () => {
      live = false;
    };
  }, [path]);
  const inside = path.startsWith(accountPad(ui));
  return (
    <Link href={name ? accountPad(ui) : accountPad(ui, "login")} className={inside ? "is-active" : undefined}>
      {name ?? accountTeksten(ui).inloggen}
    </Link>
  );
}
