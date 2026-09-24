import { ANONYMOUS, contentResource, permit, permitted, userSubject } from "@imprint/content-core";
import type { PublicRouteContext, PublicRouteResult } from "@imprint/runtime-admin";
import { WikiView } from "./view";
import { getWiki, getWikiTree } from "./wiki";

/**
 * The wiki's public route (design/wiki.md: site-in-de-site): the first URL
 * segment is the wiki's slug, the last the page's; the folder chain in
 * between is cosmetic. In the prerendered catch-all a restricted wiki, or a
 * restricted page in a public wiki, is sent to /members; there the PDP
 * decides for the session at hand (design/fase-3 §4.3).
 */
export async function wikiPublicRoute({ imprint, slug, members, session }: PublicRouteContext): Promise<PublicRouteResult | null> {
  const store = imprint.writableStore;
  if (!store || slug.length === 0) return null;
  const wiki = await getWiki(store, slug[0]);
  if (!wiki) return null;
  const joined = slug.join("/");
  const wanted = slug.length > 1 ? slug[slug.length - 1] : null;
  const tree = await getWikiTree(store, wiki.slug);

  if (!members) {
    if (wiki.access === "restricted") return { redirect: `/members/${joined}` };
    // A restricted page inside a public wiki: off the tree here, on it under /members.
    const pages = tree.pages.filter((p) => p.access === "public");
    const page = wanted ? (pages.find((p) => p.slug === wanted) ?? null) : null;
    if (wanted && !page) {
      return tree.pages.some((p) => p.slug === wanted) ? { redirect: `/members/${joined}` } : null;
    }
    return {
      render: <WikiView wiki={wiki} folders={tree.folders} pages={pages} current={page} />,
      metadata: { title: page ? `${page.title} — ${wiki.title}` : wiki.title, description: wiki.description },
    };
  }

  const subject = session ? userSubject(session.name, session.role) : ANONYMOUS;
  if (!(await permit(imprint.pdp, subject, "read", contentResource("wiki", wiki.slug, wiki)))) return null;
  const pages = await permitted(imprint.pdp, subject, "wiki-page", tree.pages, (p) => p.slug);
  const page = wanted ? (pages.find((p) => p.slug === wanted) ?? null) : null;
  if (wanted && !page) return null;
  return {
    render: <WikiView wiki={wiki} folders={tree.folders} pages={pages} current={page} />,
    metadata: { title: page ? `${page.title} — ${wiki.title}` : wiki.title, description: wiki.description },
  };
}
