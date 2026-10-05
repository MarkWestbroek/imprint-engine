import type { Metadata } from "next";
import { SearchPage } from "@imprint/runtime-admin";
import { imprint, store } from "@/lib/content";

/**
 * Site search: the engine's standard page (content-core/search.ts, every
 * type describes how it is found) in this site's chrome, over the visitor's
 * store. Per request (the query is in the URL).
 */
export const metadata: Metadata = { title: "Zoeken", robots: { index: false } };
// Canonical: /search (plugins and core routes are English); /zoeken forwards here (zoeken/route.ts).

type Props = { searchParams: Promise<{ q?: string }> };

export default async function Search({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const definitions = imprint.contentTypes.registry.definitions().filter((d) => imprint.contentTypes.has(d.name));
  return (
    <article className="cg-page">
      <SearchPage definitions={definitions} store={store} q={q} log={imprint.users} />
    </article>
  );
}
