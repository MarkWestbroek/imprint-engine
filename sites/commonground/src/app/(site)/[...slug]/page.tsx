import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { pluginPublicRoute, readOpts } from "@imprint/runtime-admin";
import { isInternal, PageView } from "@/components/page-view";
import { imprint, store } from "@/lib/content";

/**
 * Every page from the store (Postgres with DATABASE_URL, content/ without),
 * rendered through the engine renderer with this site's widgets. `home` is
 * served on /, and the building blocks (`_footer`, `_view/*`) are no pages.
 * Plugins get the first say: the wiki claims `/<wiki>/…` (design/wiki.md).
 */

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

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

export default async function ContentPage({ params, searchParams }: Props) {
  const parts = (await params).slug.map(decodeURIComponent);
  const slug = parts.join("/");
  if (slug === "home") permanentRedirect("/");
  // URL aliases from the site config (Dutch names for the English routes): /zoeken → /search, /groep/x → /groups/x.
  const opts = await readOpts();
  const target = (await store.getSiteConfig(opts)).aliases[parts[0]!];
  if (target) {
    const query = new URLSearchParams(
      Object.entries(await searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v !== undefined ? [[k, v]] : []))
    ).toString();
    permanentRedirect(`/${[target, ...parts.slice(1)].join("/")}${query ? `?${query}` : ""}`);
  }
  const hit = await pluginPublicRoute({ imprint, slug: slug.split("/"), members: false, session: null });
  if (hit) {
    if ("redirect" in hit) redirect(hit.redirect);
    return <article className="cg-page">{hit.render}</article>;
  }
  const page = isInternal(slug) ? null : await store.getPage(slug, opts);
  if (!page) notFound();
  return (
    <article className="cg-page">
      <PageView page={page} />
    </article>
  );
}
