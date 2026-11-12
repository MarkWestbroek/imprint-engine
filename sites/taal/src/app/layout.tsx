import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { store } from "@/lib/content";
import "./globals.css";

const sans = Inter({
  // Polish needs latin-ext (ą, ę, ł, ż).
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
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
      <body className={sans.variable}>{children}</body>
    </html>
  );
}
