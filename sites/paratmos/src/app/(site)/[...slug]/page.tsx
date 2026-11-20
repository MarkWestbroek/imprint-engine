import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { pluginPublicRoute, readOpts } from "@imprint/runtime-admin";
import { isInternal, PageView } from "@/components/page-view";
import { imprint, store } from "@/lib/content";

/**
 * Every page from the store (Postgres with DATABASE_URL, content/ without),
 * rendered through the engine renderer with this site's widgets. `home` is
 * served on /; `_view/*` templates are no pages; an alias redirects. A page
 * from the store wins; after that the plugins get their say: the blog claims
 * `/blog`, the glossary `/terms`, the wiki `/kennisbank/…`.
 */

type Props = { params: Promise<{ slug: string[] }> };

export async function generateStaticParams() {
  const pages = await store.listPages();
  return pages.filter((p) => !isInternal(p.slug) && p.slug !== "home").map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await store.getPage(slug.join("/"));
  if (page) return { title: page.title, description: page.description };
  const hit = await pluginPublicRoute({ imprint, slug, members: false, session: null });
  return hit && "render" in hit && hit.metadata ? hit.metadata : {};
}

export default async function ContentPage({ params }: Props) {
  const parts = (await params).slug.map(decodeURIComponent);
  const slug = parts.join("/");
  if (slug === "home") permanentRedirect("/");
  const opts = await readOpts();
  // Old addresses and Dutch names from the site config's aliases (`"begrip": "terms"`): /begrip/x → /terms/x.
  const aliases = (await store.getSiteConfig(opts)).aliases;
  if (parts[0]! in aliases) permanentRedirect(`/${[aliases[parts[0]!], ...parts.slice(1)].filter(Boolean).join("/")}`);
  const page = isInternal(slug) ? null : await store.getPage(slug, opts);
  if (page) return <PageView page={page} />;
  const hit = await pluginPublicRoute({ imprint, slug: parts, members: false, session: null });
  // No member area on this site: content that is not public is not shown.
  if (!hit || "redirect" in hit) notFound();
  return hit.render;
}
