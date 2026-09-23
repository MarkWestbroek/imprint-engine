import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { permitted } from "@imprint/content-core";
import { imprint } from "@/lib/content";
import { getSession } from "@/lib/auth";
import { authorize, subjectOf } from "@/lib/authorize";
import { readOpts } from "@/lib/preview";
import { getWiki, getWikiTree } from "@/lib/wiki";
import { PageBody } from "@/components/page-body";
import { WikiView } from "@/components/wiki-view";

/**
 * Restricted content lives here (design/fase-3 §4.3, decision: own path).
 * The public catch-all is prerendered and must never hold restricted content,
 * so it sends restricted slugs to /members/<slug>; this route renders per
 * request, for the session at hand, after the PDP said yes. Denied — or not
 * signed in — is a 404: the URL does not confirm that something exists.
 *
 * Same content as the catch-all (pages, wikis), same look; only who may see
 * it differs. Products, components and releases have no restricted view yet:
 * restricted ones simply vanish from the public site (backlog).
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const reader = imprint.storeFor(subjectOf(await getSession()));
  const page = await reader.getPage(slug.join("/"), await readOpts());
  return page ? { title: page.title, description: page.description, robots: { index: false } } : {};
}

export default async function MembersPage({ params }: Props) {
  const { slug } = await params;
  const joined = slug.join("/");
  const session = await getSession();
  const subject = subjectOf(session);
  const opts = await readOpts();

  const wiki = await getWiki(slug[0]);
  if (wiki) {
    if (!(await authorize(session, "read", { type: "wiki", id: wiki.slug, data: wiki }))) notFound();
    const tree = await getWikiTree(wiki.slug);
    const pages = await permitted(imprint.pdp, subject, "wiki-page", tree.pages, (p) => p.slug);
    const wikiPage =
      slug.length > 1 ? (pages.find((p) => p.slug === slug[slug.length - 1]) ?? null) : null;
    if (slug.length > 1 && !wikiPage) notFound();
    return <WikiView wiki={wiki} folders={tree.folders} pages={pages} current={wikiPage} />;
  }

  const page = await imprint.storeFor(subject).getPage(joined, opts);
  if (!page) notFound();
  return <PageBody page={page} reader={subject} />;
}
