import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { store } from "@/lib/content";
import "./globals.css";

const sans = Inter({
  // Polish needs latin-ext (ą, ę, ł, ż).
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

/** A serif with a lively italic, for the title of the front page (globals.css: .hero-title). */
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await store.getSiteConfig();
  return {
    metadataBase: new URL(site.baseUrl),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
    description: site.tagline,
    // A first version, with Polish texts still to be read by a Polish speaker: out of the search engines until launch.
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
