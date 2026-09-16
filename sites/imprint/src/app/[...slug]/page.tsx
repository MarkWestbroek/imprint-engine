import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown, PageRenderer } from "@imprint/runtime-admin";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * Pages from the content store — Postgres with DATABASE_URL, content/ without —
 * rendered by the same engine renderer as MusicBrain, through this site's own
 * widget selection (exit criterion of Fase 2). The hand-built routes
 * (/, /mogelijkheden, /praktijk, /merk) take precedence over this catch-all.
 */

type Props = { params: Promise<{ slug: string[] }> };

// "_view/*" pages are per-type default-view templates, not public pages.
const isViewTemplate = (slug: string) => slug.startsWith("_view/");

export async function generateStaticParams() {
  const pages = await store.listPages();
  return pages.filter((p) => !isViewTemplate(p.slug)).map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await store.getPage((await params).slug.join("/"));
  return page ? { title: page.title, description: page.description } : {};
}

export default async function ContentPage({ params }: Props) {
  const slug = (await params).slug.join("/");
  const page = isViewTemplate(slug) ? null : await store.getPage(slug);
  if (!page) notFound();

  return (
    <>
      <SiteHeader />
      <main className="page-main">
        <article className="content-page">
          {page.layout ? (
            <PageRenderer
              page={{ ...page, layout: page.layout }}
              viewers={widgetComponents}
              ctx={widgetContext()}
            />
          ) : (
            <>
              <h1>{page.title}</h1>
              <Markdown>{page.body}</Markdown>
            </>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
