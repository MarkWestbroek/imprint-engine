import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { store } from "@/lib/content";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await store.getSiteConfig();
  return {
    metadataBase: new URL(site.baseUrl),
    title: { default: site.name, template: `%s — ${site.name}` },
    description: site.tagline,
    // A closed workplace: never in a search engine.
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl">
      <body className={sans.variable}>{children}</body>
    </html>
  );
}
