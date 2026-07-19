import { store } from "@/lib/content";

/**
 * RSS 2.0 feed of the devlog (W6): the posts/ pages, newest first. Hand-rolled
 * XML — a dependency for twelve lines of markup is not worth it. Prerendered
 * like the rest of the public site; admin saves revalidate it.
 */

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET() {
  const [site, posts] = await Promise.all([
    store.getSiteConfig(),
    store.listPages({ prefix: "posts/" }),
  ]);

  const items = posts
    .slice(0, 20)
    .map((p) => {
      const url = `${site.baseUrl}/${p.slug}`;
      const date = p.publishedAt ? new Date(p.publishedAt).toUTCString() : "";
      // Plain-text excerpt: strip the most common markdown syntax.
      const excerpt = p.body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#*_`>]/g, "")
        .trim()
        .slice(0, 500);
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid>${esc(url)}</guid>
      ${date ? `<pubDate>${date}</pubDate>` : ""}
      <description>${esc(excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(site.name)} — devlog</title>
    <link>${esc(site.baseUrl)}</link>
    <description>${esc(site.tagline)}</description>
    <language>${site.defaultLocale}</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
