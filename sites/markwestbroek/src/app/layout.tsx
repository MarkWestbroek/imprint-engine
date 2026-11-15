import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import { store } from "@/lib/content";
import "./globals.css";

const sans = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
});
/** Headings and the name on the source module: tall and industrial, like a poster. */
const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-display",
  // Next has no metrics for this face to tune a fallback with; without this it warns on every compile.
  adjustFontFallback: false,
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await store.getSiteConfig();
  return {
    metadataBase: new URL(site.baseUrl),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
    description: site.tagline,
    // Placeholders still in the texts: out of the search engines until launch.
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl">
      <body className={`${sans.variable} ${mono.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
