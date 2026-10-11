import Link from "next/link";
import { Menu as MenuIcon } from "lucide-react";
import type { Menu } from "@imprint/content-core";
import { OmniumMark } from "@/components/logo";

/**
 * The Omnium chrome: mark and name on the left, the "main" menu from the store
 * (edited in the admin), and a quiet footer. A thin band in the brand
 * gradient is the only flourish.
 */

export type NavItem = { href: string; label: string };

export function menuToNav(menu: Menu | null): NavItem[] {
  return (menu?.items ?? []).map((item) => ({
    href: item.page !== undefined ? `/${item.page === "home" ? "" : item.page}` : (item.url ?? "/"),
    label: item.label,
  }));
}

export function SiteHeader({ nav }: { nav: NavItem[] }) {
  return (
    <header className="om-header">
      <div className="om-container om-header-row">
        <Link className="om-brand" href="/" aria-label="Omnium, naar home">
          <OmniumMark className="om-mark" />
          <span>Omnium</span>
        </Link>
        <nav aria-label="Hoofdmenu" className="om-nav">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <details className="om-mobile-menu">
          <summary aria-label="Menu openen">
            <MenuIcon size={22} />
          </summary>
          <div>
            {nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="om-footer">
      <div className="om-container om-footer-row">
        <Link className="om-brand" href="/">
          <OmniumMark className="om-mark" />
          <span>Omnium</span>
        </Link>
        <p>Een modelwerkbank voor één canoniek model en een bitemporeel register. Proof of concept, in actieve ontwikkeling.</p>
        <p className="om-footer-small">
          Een initiatief van Paratmos · <Link href="/privacy">Privacy</Link> · gemaakt met{" "}
          <a href="https://imprint-engine.nl">Imprint</a>
        </p>
      </div>
    </footer>
  );
}
