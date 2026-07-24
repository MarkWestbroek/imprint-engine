import Link from "next/link";
import type { SiteConfig, Theme } from "@imprint/content-core";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * Patch-brain mark ("open brain"-ontwerp, richting A): jack-nodes verbonden
 * door kabel-bogen die samen een brein suggereren. Kleurt mee met het thema
 * (accent voor de kabels, background als node-vulling).
 */
function BrainMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 70 60"
      className={className}
      aria-label="MusicBrain mark"
      role="img"
    >
      <g fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
        <path d="M14 42 Q 12 18 33 13" />
        <path d="M33 13 Q 58 12 57 33" />
        <path d="M14 42 Q 20 54 38 51" />
        <path d="M38 51 Q 54 48 57 33" />
        <path d="M25 32 Q 35 24 46 33" />
      </g>
      <g fill="var(--background)" stroke="var(--accent)" strokeWidth="3">
        <circle cx="14" cy="42" r="5.5" />
        <circle cx="33" cy="13" r="5.5" />
        <circle cx="57" cy="33" r="5.5" />
        <circle cx="38" cy="51" r="5.5" />
      </g>
      <circle cx="35.5" cy="31" r="4" fill="var(--accent)" />
    </svg>
  );
}

/**
 * The site's framing — header with menu, footer. The public layout wraps
 * every page in it, and the studio wraps the edit canvas in it, so editors
 * see a page in its real context ("de omlijsting").
 */
export function SiteChrome({
  site,
  nav,
  themes = [],
  children,
  inert = false,
}: {
  site: SiteConfig;
  nav: { href: string; label: string }[];
  /** Available themes; ≥2 shows the user-facing switcher. */
  themes?: Theme[];
  children: React.ReactNode;
  /** Studio mode: chrome is visible but not clickable. */
  inert?: boolean;
}) {
  const chromeCls = inert ? "pointer-events-none select-none" : "";
  return (
    <>
      <header className={`border-b border-line ${chromeCls}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <Link href="/" className="flex items-center gap-4">
            <BrainMark className="h-12 w-14" />
            <span className="leading-tight">
              <span className="block text-2xl font-bold tracking-tight">
                Music<span className="text-accent">Brain</span>
              </span>
              <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                {site.motto || site.tagline}
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
            {/* Stays clickable in the studio's inert chrome: trying themes is
                exactly what the canvas preview is for. */}
            <span className={inert ? "pointer-events-auto" : undefined}>
              <ThemeSwitcher
                themes={themes.map((t) => ({ name: t.name, label: t.label }))}
              />
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>

      <footer className={`border-t border-line ${chromeCls}`}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-2 px-4 py-6 text-sm text-muted">
          <p className="flex flex-wrap gap-x-4 font-mono text-xs">
            {site.links.github && (
              <a
                href={site.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                github
              </a>
            )}
            {site.links.discord && (
              <a
                href={site.links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                discord
              </a>
            )}
            <span>
              © {new Date().getFullYear()} {site.name} · open source, open
              hardware
            </span>
          </p>
          <p className="text-xs">
            No relation to MusicBrainz — we make music gear, they make the
            music encyclopedia.
          </p>
        </div>
      </footer>
    </>
  );
}

/** The public header nav from the "main" menu, with a fallback. */
export function menuToNav(
  menu: { items: { label: string; page?: string; url?: string }[] } | null
): { href: string; label: string }[] {
  return (
    menu?.items.map((item) => ({
      href: item.page ? `/${item.page}` : (item.url ?? "#"),
      label: item.label,
    })) ?? [
      { href: "/#products", label: "Products" },
      { href: "/releases", label: "Releases" },
      { href: "/about", label: "About" },
    ]
  );
}
