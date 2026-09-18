import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { ThemeInit, ThemeStyles } from "@/components/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await store.getSiteConfig(await readOpts());
  return {
    metadataBase: new URL(site.baseUrl),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
    description: site.tagline,
    alternates: { types: { "application/rss+xml": "/feed.xml" } },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme CSS of the previewed moment ({} for visitors, so pages stay static).
  const themes = await store.listThemes(await readOpts());
  return (
    // ThemeInit sets data-theme on <html> before hydration (no flash), so the
    // client legitimately differs from the server here — this element only.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Before anything paints: apply the saved theme (no flash). */}
        <ThemeInit />
        <ThemeStyles themes={themes} />
        {children}
      </body>
    </html>
  );
}
