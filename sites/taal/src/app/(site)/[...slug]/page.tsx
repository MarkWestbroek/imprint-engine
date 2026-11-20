import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { pluginPublicRoute, readOpts } from "@imprint/runtime-admin";
import { Leerling, taalStaticPaths } from "@imprint/plugin-taal";
import { isInternal, PageView } from "@/components/page-view";
import { imprint, store } from "@/lib/content";
import { pluginAction } from "@/app/admin/actions";
import { INGANGEN, ingangMetHome } from "@/lib/ingang";
import { TAAL } from "../../../../imprint.config";

/**
 * Everything but the start: the front page of another entrance (`/en`: the
 * page `home-en`, lib/ingang.ts), the lessons (`/<ui>/<pakket>/<les>`, claimed
 * by plugin-taal) and the pages from the store, through the engine renderer.
 * All are prerendered; a save in the admin revalidates.
 */

/** The front page behind `/<ui>`, when that entrance has one in the store. */
async function voorpagina(parts: string[], opts?: Parameters<typeof store.getPage>[1]) {
  const ingang = parts.length === 1 ? INGANGEN.find((i) => i.start === `/${parts[0]}`) : undefined;
  return ingang ? store.getPage(ingang.home, opts) : null;
}

type Props = { params: Promise<{ slug: string[] }> };

export async function generateStaticParams() {
  const pages = await store.listPages();
  return [
    ...pages.filter((p) => !isInternal(p.slug) && !ingangMetHome(p.slug)).map((p) => ({ slug: p.slug.split("/") })),
    ...INGANGEN.filter((i) => i.start !== "/").map((i) => ({ slug: i.start.slice(1).split("/") })),
    ...(await taalStaticPaths(imprint.writableStore, TAAL)).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const home = await voorpagina(slug);
  if (home) return { title: { absolute: home.title }, description: home.description };
  const hit = await pluginPublicRoute({ imprint, slug, members: false, session: null });
  if (hit) return "render" in hit && hit.metadata ? hit.metadata : {};
  const page = await store.getPage(slug.join("/"));
  return page ? { title: page.title, description: page.description } : {};
}

export default async function ContentPage({ params }: Props) {
  const parts = (await params).slug.map(decodeURIComponent);
  const slug = parts.join("/");
  const eigenHome = ingangMetHome(slug);
  if (eigenHome) permanentRedirect(eigenHome.start);
  const home = await voorpagina(parts, await readOpts());
  if (home) {
    return (
      <>
        {/* For a member: bring the browser's results and the account's in line, so "verder" knows. */}
        <Leerling call={pluginAction} />
        <PageView page={home} />
      </>
    );
  }
  const hit = await pluginPublicRoute({ imprint, slug: parts, members: false, session: null, call: pluginAction });
  if (hit) {
    if ("redirect" in hit) redirect(hit.redirect);
    return hit.render;
  }
  const page = isInternal(slug) ? null : await store.getPage(slug, await readOpts());
  if (!page) notFound();
  return <PageView page={page} />;
}
