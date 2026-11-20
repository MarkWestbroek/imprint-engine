import type { Metadata } from "next";
import localFont from "next/font/local";
import { imprint, store } from "@/lib/content";
import "./globals.css";

/*
 * The fonts are files in src/fonts (latin subset, SIL Open Font License), not
 * fetched from Google Fonts: the build needs no network for them and a
 * visitor's browser never calls Google.
 */

/** The brand font (merkrichtlijnen §5): the word mark and the headings. Montserrat, variable weight. */
const display = localFont({
  src: "../fonts/montserrat-latin-var.woff2",
  weight: "100 900",
  variable: "--font-display",
});
/** Body text: a plain sans that reads well on a screen. IBM Plex Sans, variable weight. */
const sans = localFont({
  src: "../fonts/ibm-plex-sans-latin-var.woff2",
  weight: "100 700",
  variable: "--font-sans",
});
/** Model elements, labels and the menu: the lettering of a diagram. IBM Plex Mono. */
const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-latin-400.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-mono-latin-500.woff2", weight: "500" },
  ],
  variable: "--font-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await store.getSiteConfig();
  return {
    metadataBase: new URL(site.baseUrl),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
    description: site.motto || site.tagline,
    // Concept texts, and the WordPress site is still the live one: out of the search engines until launch.
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={imprint.defaultLocale}>
      <body className={`${sans.variable} ${mono.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
