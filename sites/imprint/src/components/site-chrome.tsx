import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { messagesFor } from "@imprint/content-core";
import { BrandMark } from "@/components/brand-mark";
import { imprint } from "@/lib/content";
import { siteMessages } from "@/messages";

/** The fixed texts in the site's language; a page in another language passes its own. */
const texts = (locale: string = imprint.uiLocale) => messagesFor(siteMessages, locale);

export function SiteHeader({ locale }: { locale?: string } = {}) {
  const t = texts(locale);
  const navigation = [
    { href: "/mogelijkheden", label: t.nav.features },
    { href: "/praktijk", label: t.nav.practice },
    { href: "/merk", label: t.nav.brand },
    { href: "/voor-opdrachtgevers", label: t.nav.clients },
  ];
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label={t.homeLabel}>
        <BrandMark className="brand-mark" />
        <span>Imprint</span>
      </Link>
      <nav aria-label={t.mainNavigation}>
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </nav>
      <a className="header-cta" href="https://github.com/MarkWestbroek/imprint-engine">
        {t.viewCode} <ArrowUpRight size={16} />
      </a>
      <details className="mobile-menu">
        <summary aria-label={t.openMenu}><Menu size={22} /></summary>
        <div>
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </div>
      </details>
    </header>
  );
}

export function SiteFooter({ locale }: { locale?: string } = {}) {
  const t = texts(locale);
  return (
    <footer>
      <Link className="brand" href="/">
        <BrandMark className="brand-mark" />
        <span>Imprint</span>
      </Link>
      <p>{t.footerLine}</p>
      <a href="https://github.com/MarkWestbroek/imprint-engine">
        GitHub <ArrowUpRight size={14} />
      </a>
    </footer>
  );
}
