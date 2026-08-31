import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const navigation = [
  { href: "/mogelijkheden", label: "Mogelijkheden" },
  { href: "/praktijk", label: "In de praktijk" },
  { href: "/merk", label: "Merkvoorstellen" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Imprint, naar home">
        <BrandMark className="brand-mark" />
        <span>Imprint</span>
      </Link>
      <nav aria-label="Hoofdnavigatie">
        {navigation.map((item) => (
          <Link href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </nav>
      <a className="header-cta" href="https://github.com/MarkWestbroek/imprint-engine">
        Bekijk de code <ArrowUpRight size={16} />
      </a>
      <details className="mobile-menu">
        <summary aria-label="Menu openen"><Menu size={22} /></summary>
        <div>
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </div>
      </details>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <Link className="brand" href="/">
        <BrandMark className="brand-mark" />
        <span>Imprint</span>
      </Link>
      <p>Ontwikkeld vanuit een echte productsite, niet vanuit een leeg template.</p>
      <a href="https://github.com/MarkWestbroek/imprint-engine">
        GitHub <ArrowUpRight size={14} />
      </a>
    </footer>
  );
}
