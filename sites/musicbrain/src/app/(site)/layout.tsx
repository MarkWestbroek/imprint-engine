import Link from "next/link";
import { store } from "@/lib/content";

/** Fallback nav for sites that don't ship a "main" menu yet. */
const FALLBACK_NAV = [
  { href: "/#products", label: "Products" },
  { href: "/releases", label: "Releases" },
  { href: "/about", label: "About" },
];

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const site = await store.getSiteConfig();
  const menu = await store.getMenu("main");
  // Header shows top-level items; an item points to a Page (by slug) or a URL.
  const nav =
    menu?.items.map((item) => ({
      href: item.page ? `/${item.page}` : (item.url ?? "#"),
      label: item.label,
    })) ?? FALLBACK_NAV;

  return (
    <>
      <header className="border-b border-line">
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
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>

      <footer className="border-t border-line">
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
