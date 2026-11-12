import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { pluginPublicRoute, readOpts } from "@imprint/runtime-admin";
import { taalStaticPaths } from "@imprint/plugin-taal";
import { isInternal, PageView } from "@/components/page-view";
import { imprint, store } from "@/lib/content";
import { pluginAction } from "@/app/admin/actions";
import { TAAL } from "../../../../imprint.config";

/**
 * Everything but the start: the lessons (`/<ui>/<pakket>/<les>`, claimed by
 * plugin-taal) and the pages from the store, through the engine renderer.
 * Both are prerendered; a save in the admin revalidates.
 */

type Props = { params: Promise<{ slug: string[] }> };

export async function generateStaticParams() {
  const pages = await store.listPages();
  return [
    ...pages.filter((p) => !isInternal(p.slug) && p.slug !== "home").map((p) => ({ slug: p.slug.split("/") })),
    ...(await taalStaticPaths(imprint.writableStore, TAAL)).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const hit = await pluginPublicRoute({ imprint, slug, members: false, session: null });
  if (hit) return "render" in hit && hit.metadata ? hit.metadata : {};
  const page = await store.getPage(slug.join("/"));
  return page ? { title: page.title, description: page.description } : {};
}

export default async function ContentPage({ params }: Props) {
  const parts = (await params).slug.map(decodeURIComponent);
  const slug = parts.join("/");
  if (slug === "home") permanentRedirect("/");
  const hit = await pluginPublicRoute({ imprint, slug: parts, members: false, session: null, call: pluginAction });
  if (hit) {
    if ("redirect" in hit) redirect(hit.redirect);
    return hit.render;
  }
  const page = isInternal(slug) ? null : await store.getPage(slug, await readOpts());
  if (!page) notFound();
  return <PageView page={page} />;
}
