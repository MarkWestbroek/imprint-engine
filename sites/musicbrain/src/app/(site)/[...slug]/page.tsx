import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { pluginPublicRoute } from "@imprint/runtime-admin";
import { imprint, store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { PageBody } from "@/components/page-body";

/**
 * Generic content pages: anything in content/pages/ that isn't claimed by a
 * dedicated route renders here — markdown pages (about, posts/*, …) as an
 * article, composed pages (.json with a layout) through the widget engine.
 * Plugins get the first say (design/fase-5 §3.3): the wiki plugin claims
 * `/<wiki>/…` and renders the tree (site-in-de-site, design/wiki.md).
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
  const hit = await pluginPublicRoute({ imprint, slug, members: false, session: null });
  if (hit && "render" in hit && hit.metadata) return hit.metadata;
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

  // A plugin may claim the URL (the wiki does): a redirect (restricted → /members) or a render.
  const hit = await pluginPublicRoute({ imprint, slug, members: false, session: null });
  if (hit) {
    if ("redirect" in hit) redirect(hit.redirect);
    return hit.render;
  }

  const page = await store.getPage(joined, opts);
  if (!page) {
    // Exists, but not for visitors: the dynamic route decides per request.
    if (await imprint.readStore.getPage(joined, opts)) redirect(`/members/${joined}`);
    notFound();
  }
  return <PageBody page={page} />;
}
