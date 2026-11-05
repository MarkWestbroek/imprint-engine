import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { WidthInit } from "@/components/width-toggle";
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
    // WidthInit sets data-breedte on <html> before hydration (no jump); React
    // did not render that attribute, hence suppressHydrationWarning.
    <html lang="nl" suppressHydrationWarning>
      <body className={sans.variable}>
        <WidthInit />
        {children}
      </body>
    </html>
  );
}
