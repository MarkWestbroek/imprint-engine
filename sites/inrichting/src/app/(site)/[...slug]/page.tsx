import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { readOpts } from "@imprint/runtime-admin";
import { isInternal, PageView } from "@/components/page-view";
import { store } from "@/lib/content";

/**
 * Every other page from the store, rendered per request (the layout reads the
 * session). `home` is served on /; `_view/*` templates are no pages; register
 * records have their own route under /inrichting.
 */

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await store.getPage((await params).slug.join("/"));
  return page ? { title: page.title, description: page.description } : {};
}

export default async function ContentPage({ params }: Props) {
  const slug = (await params).slug.map(decodeURIComponent).join("/");
  if (slug === "home") permanentRedirect("/");
  const page = isInternal(slug) ? null : await store.getPage(slug, await readOpts());
  if (!page) notFound();
  return <PageView page={page} />;
}
