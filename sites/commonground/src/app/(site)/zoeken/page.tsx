import type { Metadata } from "next";
import Link from "next/link";
import { readOpts } from "@imprint/runtime-admin";
import { isInternal } from "@/components/page-view";
import { store } from "@/lib/content";

/**
 * Simple search over the public pages: title, description and all the text
 * in the body and widgets. Per request (the query is in the URL); the store
 * only returns what this visitor may see. A real index comes with groups and
 * news (design/communities.md).
 */

export const metadata: Metadata = { title: "Zoeken", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string }> };

/** All string values in a page's layout, flattened: widget texts, titles, captions. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
}

const normalise = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function SearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim();
  const terms = normalise(q).split(/\s+/).filter(Boolean);
  const pages = terms.length ? (await store.listPages(await readOpts())).filter((p) => !isInternal(p.slug)) : [];
  const hits = pages
    .map((page) => {
      const haystack = normalise(`${page.title} ${page.description ?? ""} ${page.body ?? ""} ${textOf(page.layout)}`);
      const inTitle = terms.filter((t) => normalise(page.title).includes(t)).length;
      return { page, match: terms.every((t) => haystack.includes(t)), score: inTitle };
    })
    .filter((h) => h.match)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title));

  return (
    <article className="cg-page">
      <h1>Zoeken</h1>
      <form action="/zoeken" role="search" className="cg-search">
        <label htmlFor="q" className="sr-only">
          Zoekterm
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Waar ben je naar op zoek?" autoFocus />
        <button type="submit">Zoeken</button>
      </form>
      {q && (
        <p className="cg-muted">
          {hits.length === 0 ? "Geen resultaten" : `${hits.length} resultaat${hits.length === 1 ? "" : "en"}`} voor
          “{q}”
        </p>
      )}
      <ul className="cg-results">
        {hits.map(({ page }) => (
          <li key={page.slug}>
            <Link href={page.slug === "home" ? "/" : `/${page.slug}`}>{page.title}</Link>
            {page.description && <p>{page.description}</p>}
          </li>
        ))}
      </ul>
    </article>
  );
}
