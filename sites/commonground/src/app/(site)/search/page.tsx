import type { Metadata } from "next";
import Link from "next/link";
import { KIND_LABEL, search, type Kind } from "@/lib/search";
import { store } from "@/lib/content";

/**
 * Site search over pages, posts, events, communities, terms and wiki pages,
 * with a prefix to narrow it (`community: archi`, `blog: togaf`). Per
 * request (the query is in the URL); the store only returns what this
 * visitor may see. A real index comes with search in the core (backlog).
 */

export const metadata: Metadata = { title: "Zoeken", robots: { index: false } };
// Canonical: /search (plugins and core routes are English); /zoeken forwards here (zoeken/route.ts).

type Props = { searchParams: Promise<{ q?: string }> };

const EXAMPLES: [string, string][] = [
  ["community: architectuur", "een community"],
  ["blog: togaf", "een blog"],
  ["term: api", "een term"],
  ["agenda: fieldlab", "een evenement"],
  ["wiki: register", "een wikipagina"],
];

export default async function SearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim();
  const { hits, kind } = q ? await search(store, q) : { hits: [], kind: null as Kind | null };
  const byKind = new Map<Kind, number>();
  for (const h of hits) byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + 1);

  return (
    <article className="cg-page">
      <h1>Zoeken</h1>
      <form action="/search" role="search" className="cg-search">
        <label htmlFor="q" className="sr-only">
          Zoekterm
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Waar ben je naar op zoek?" autoFocus />
        <button type="submit">Zoeken</button>
      </form>
      <p className="cg-muted cg-search-hint">
        Tip: zoek in één soort met een voorvoegsel, bijvoorbeeld{" "}
        {EXAMPLES.map(([ex, what], i) => (
          <span key={ex}>
            {i > 0 && ", "}
            <Link href={`/search?q=${encodeURIComponent(ex)}`}>
              <code>{ex}</code>
            </Link>{" "}
            ({what})
          </span>
        ))}
        .
      </p>
      {q && (
        <p className="cg-muted">
          {hits.length === 0 ? "Geen resultaten" : hits.length === 1 ? "1 resultaat" : `${hits.length} resultaten`} voor “{q}”
          {kind && ` in ${KIND_LABEL[kind]}s`}
          {!kind && hits.length > 0 && (
            <>
              {" · "}
              {[...byKind].map(([k, n]) => `${n} ${KIND_LABEL[k]}${n === 1 || k === "news" ? "" : "s"}`).join(", ")}
            </>
          )}
        </p>
      )}
      <ul className="cg-results">
        {hits.slice(0, 100).map((h) => (
          <li key={`${h.kind}-${h.href}`}>
            <span className="cg-badge-soft">{KIND_LABEL[h.kind]}</span> <Link href={h.href}>{h.title}</Link>
            {h.summary && <p>{h.summary}</p>}
          </li>
        ))}
      </ul>
      {hits.length > 100 && <p className="cg-muted">De eerste 100 worden getoond; maak je zoekterm preciezer.</p>}
    </article>
  );
}
