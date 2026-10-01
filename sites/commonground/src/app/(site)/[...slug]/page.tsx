import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { pluginPublicRoute, readOpts } from "@imprint/runtime-admin";
import { isInternal, PageView } from "@/components/page-view";
import { Thread } from "@/components/thread";
import { imprint, store } from "@/lib/content";
import { pluginAction } from "@/app/admin/actions";

/**
 * Every page from the store (Postgres with DATABASE_URL, content/ without),
 * rendered through the engine renderer with this site's widgets. `home` is
 * served on /, and the building blocks (`_footer`, `_view/*`) are no pages.
 * Plugins get the first say: the wiki claims `/<wiki>/…` (design/wiki.md).
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
  // URL aliases from the site config (Dutch names for the English routes): /groep/x → /groups/x.
  // No query string here: reading searchParams would make this prerendered route dynamic (/zoeken has its own route).
  const opts = await readOpts();
  const target = (await store.getSiteConfig(opts)).aliases[parts[0]!];
  if (target) permanentRedirect(`/${[target, ...parts.slice(1)].join("/")}`);
  // `call`: a server action reference is static, so client islands (a join button) may act on a prerendered page.
  const hit = await pluginPublicRoute({ imprint, slug: slug.split("/"), members: false, session: null, call: pluginAction });
  if (hit) {
    if ("redirect" in hit) redirect(hit.redirect);
    return (
      <article className="cg-page">
        {hit.render}
        {hit.item && <Thread type={hit.item.type} slug={hit.item.slug} path={`/${slug}`} />}
      </article>
    );
  }
  const page = isInternal(slug) ? null : await store.getPage(slug, opts);
  if (!page) {
    // Exists, but not for everyone: /members decides per request (design/communities.md §4.2).
    if (!isInternal(slug) && (await imprint.readStore.getPage(slug, opts))) redirect(`/members/${slug}`);
    notFound();
  }
  return (
    <article className="cg-page">
      <PageView page={page} />
      <Thread type="page" slug={page.slug} path={`/${slug}`} />
    </article>
  );
}
