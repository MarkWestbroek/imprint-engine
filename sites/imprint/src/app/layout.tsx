import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { imprint, store } from "@/lib/content";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await store.getSiteConfig();
  return {
    metadataBase: new URL(site.baseUrl),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
    description: site.tagline,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={imprint.defaultLocale}>
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
