import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { imprint, store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { getWiki, getWikiTree } from "@/lib/wiki";
import { PageBody } from "@/components/page-body";
import { WikiView } from "@/components/wiki-view";

/**
 * Generic content pages: anything in content/pages/ that isn't claimed by a
 * dedicated route renders here — markdown pages (about, posts/*, …) as an
 * article, composed pages (.json with a layout) through the widget engine.
 * A first segment that matches a Wiki-slug renders the wiki instead
 * (site-in-de-site, design/wiki.md): tree navigation left, page right.
 *
 * Prerendered, so it only ever sees the visitor's view (`store` is the guarded
 * store): restricted content is not here, it is sent on to /members/… which
 * renders per request (design/fase-3 §4.3). No cookies are read on this route.
 */

type Props = { params: Promise<{ slug: string[] }> };

// dynamicParams stays on (default): pages created in /admin must appear
// without a rebuild. Unknown slugs still 404 via notFound() below.
// "_view/*" pages are per-type default-view templates, not public pages.
const isViewTemplate = (slug: string) => slug.startsWith("_view/");

export async function generateStaticParams() {
  const pages = await store.listPages();
  return pages
    .filter((p) => !isViewTemplate(p.slug))
    .map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await store.getPage(slug.join("/"));
  if (page) return { title: page.title, description: page.description };
  const wiki = await getWiki(slug[0]);
  if (wiki && wiki.access === "public") {
    const { pages } = await getWikiTree(wiki.slug);
    const wikiPage = slug.length > 1 ? pages.find((p) => p.slug === slug[slug.length - 1]) : null;
    return {
      title: wikiPage ? `${wikiPage.title} — ${wiki.title}` : wiki.title,
      description: wiki.description,
    };
  }
  return {};
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const joined = slug.join("/");
  if (isViewTemplate(joined)) notFound(); // template, not a public page

  // URL-aliases uit de site-config (MMB-vraag 1): /hw/adc8 → /components/adc8.
  // Permanente redirect, dus zoekmachines volgen de echte route.
  const opts = await readOpts();
  const site = await store.getSiteConfig(opts);
  const target = site.aliases[slug[0]];
  if (target) {
    permanentRedirect(`/${[target, ...slug.slice(1)].join("/")}`);
  }

  // Wiki? Het eerste segment kan een wiki-slug zijn. Opgelost wordt op het
  // laatste segment (paginaslug, uniek per wiki) — het folderpad in de URL
  // is cosmetisch, dus een verplaatste pagina breekt geen oude links.
  const wiki = await getWiki(slug[0]);
  if (wiki) {
    if (wiki.access === "restricted") redirect(`/members/${joined}`);
    const { folders, pages: all } = await getWikiTree(wiki.slug);
    // A restricted page inside a public wiki: off the tree here, on it under /members.
    const pages = all.filter((p) => p.access === "public");
    const wanted = slug.length > 1 ? slug[slug.length - 1] : null;
    const wikiPage = wanted ? (pages.find((p) => p.slug === wanted) ?? null) : null;
    if (wanted && !wikiPage) {
      if (all.some((p) => p.slug === wanted)) redirect(`/members/${joined}`);
      notFound();
    }
    return <WikiView wiki={wiki} folders={folders} pages={pages} current={wikiPage} />;
  }

  const page = await store.getPage(joined, opts);
  if (!page) {
    // Exists, but not for visitors: the dynamic route decides per request.
    if (await imprint.readStore.getPage(joined, opts)) redirect(`/members/${joined}`);
    notFound();
  }
  return <PageBody page={page} />;
}
