import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { isInternal, PageView } from "@/components/page-view";
import { store } from "@/lib/content";
import { pageHref, pageMetadata, pageReadOptions, SITE } from "@/lib/locale";

/**
 * An English page: the same slug as the Dutch one, under /en. Only pages are
 * translated; a page without an English version (and the Dutch-only blog,
 * knowledge base and glossary) redirects to the Dutch address. The English
 * pages are prerendered; other addresses are resolved on request
 * (dynamicParams), which is what makes that redirect possible.
 */
const LOCALE = "en";
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string[] }> };

export async function generateStaticParams() {
  const pages = await store.listPages({ lang: LOCALE, exactLang: true });
  return pages.filter((p) => !isInternal(p.slug) && p.slug !== "home").map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata((await params).slug.map(decodeURIComponent).join("/"), LOCALE);
}

export default async function EnglishPage({ params }: Props) {
  const slug = (await params).slug.map(decodeURIComponent).join("/");
  if (slug === "home") permanentRedirect(`/${LOCALE}`);
  const page = isInternal(slug) ? null : await store.getPage(slug, await pageReadOptions(LOCALE));
  if (page) return <PageView page={page} locale={LOCALE} />;
  // No English version: the Dutch page (or the Dutch blog, wiki, glossary) at its own address.
  if (slug) redirect(pageHref(SITE.defaultLocale, slug));
  notFound();
}
