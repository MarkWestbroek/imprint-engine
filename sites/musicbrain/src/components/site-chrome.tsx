import Link from "next/link";
import type { SiteConfig, Theme } from "@imprint/content-core";
import { ThemeSwitcher } from "@/components/theme-switcher";

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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            <span className="text-accent">Music</span>Brain
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
            {site.links.github && (
              <a
                href={site.links.github}
                className="hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            )}
            <ThemeSwitcher
              themes={themes.map((t) => ({ name: t.name, label: t.label }))}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>

      <footer className={`border-t border-line ${chromeCls}`}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
          <p>
            © {new Date().getFullYear()} {site.name}. Open source, open hardware.
          </p>
          <p>
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
