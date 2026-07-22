import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { getSession } from "@/lib/auth";
import { authorize } from "@/lib/authorize";
import { getWiki, getWikiTree } from "@/lib/wiki";
import { Markdown } from "@/components/markdown";
import { PageRenderer } from "@/components/page-renderer";
import { WikiView } from "@/components/wiki-view";

/**
 * Generic content pages: anything in content/pages/ that isn't claimed by a
 * dedicated route renders here — markdown pages (about, posts/*, …) as an
 * article, composed pages (.json with a layout) through the widget engine.
 * A first segment that matches a Wiki-slug renders the wiki instead
 * (site-in-de-site, design/wiki.md): tree navigation left, page right.
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
  if (wiki && wiki.visibility === "public") {
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
  const site = await store.getSiteConfig();
  const target = site.aliases[slug[0]];
  if (target) {
    permanentRedirect(`/${[target, ...slug.slice(1)].join("/")}`);
  }

  // Wiki? Het eerste segment kan een wiki-slug zijn. Opgelost wordt op het
  // laatste segment (paginaslug, uniek per wiki) — het folderpad in de URL
  // is cosmetisch, dus een verplaatste pagina breekt geen oude links.
  const wiki = await getWiki(slug[0]);
  if (wiki) {
    // PEP: members-wiki's vragen een sessie (maakt de render dynamisch —
    // precies goed: ledencontent hoort niet in statische HTML); publieke
    // wiki's checken zonder cookies en blijven cachebaar.
    const session = wiki.visibility === "members" ? await getSession() : null;
    const allowed = authorize(session, "read", {
      type: "wiki",
      slug: wiki.slug,
      visibility: wiki.visibility,
      wiki: wiki.slug,
    });
    if (!allowed) notFound();

    const { folders, pages } = await getWikiTree(wiki.slug);
    const wikiPage =
      slug.length > 1 ? (pages.find((p) => p.slug === slug[slug.length - 1]) ?? null) : null;
    if (slug.length > 1 && !wikiPage) notFound();
    return <WikiView wiki={wiki} folders={folders} pages={pages} current={wikiPage} />;
  }

  const page = await store.getPage(joined, await readOpts());
  if (!page) notFound();

  if (page.layout) {
    return <PageRenderer page={{ ...page, layout: page.layout }} />;
  }

  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      {page.publishedAt && (
        <p className="mt-2 text-sm text-muted">{page.publishedAt}</p>
      )}
      <div className="mt-6">
        <Markdown>{page.body}</Markdown>
      </div>
    </article>
  );
}
