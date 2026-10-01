import Link from "next/link";
import { search, searchKinds, type ContentStore, type ContentTypeDefinition } from "@imprint/content-core";

/**
 * The standard search page (content-core/search.ts): a form, a hint with
 * the prefixes the site's types offer, and the hits with their kind. A site
 * mounts it in its own chrome at `/search` and gives it the store of the
 * visitor at hand, so nobody sees what they may not. Styled with the token
 * classes every site's theme provides (architecture.md §3).
 */
export async function SearchPage({
  definitions,
  store,
  q,
  action = "/search",
  limit = 100,
}: {
  /** The site's active content types; those with `search` take part. */
  definitions: ContentTypeDefinition[];
  store: ContentStore;
  q: string;
  action?: string;
  limit?: number;
}) {
  const kinds = searchKinds(definitions);
  const result = q.trim() ? await search(definitions, store, q) : null;
  const examples = Object.entries(kinds).map(([kind, k]) => ({ kind, prefix: k.prefixes[0]!, label: k.label }));

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">Zoeken</h1>
      <form action={action} role="search" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          Zoekterm
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Waar ben je naar op zoek?"
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-accent px-5 py-2 font-semibold text-background hover:bg-accent-strong">
          Zoeken
        </button>
      </form>
      {examples.length > 1 && (
        <p className="mt-3 text-sm text-muted">
          Tip: zoek in één soort met een voorvoegsel, bijvoorbeeld{" "}
          {examples.map((e, i) => (
            <span key={e.kind}>
              {i > 0 && ", "}
              <Link href={`${action}?q=${encodeURIComponent(`${e.prefix}: `)}`} className="underline">
                <code>{e.prefix}:</code>
              </Link>{" "}
              ({e.label})
            </span>
          ))}
          .
        </p>
      )}
      {result && (
        <p className="mt-6 text-muted">
          {result.hits.length === 0 ? "Geen resultaten" : result.hits.length === 1 ? "1 resultaat" : `${result.hits.length} resultaten`} voor “{q.trim()}”
          {result.kind && ` (${kinds[result.kind]?.label ?? result.kind})`}
          {!result.kind && result.hits.length > 0 && (
            <>
              {" · "}
              {Object.entries(result.counts)
                .map(([kind, n]) => `${n} ${kinds[kind]?.label ?? kind}`)
                .join(", ")}
            </>
          )}
        </p>
      )}
      {result && result.hits.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {result.hits.slice(0, limit).map((h) => (
            <li key={`${h.kind}-${h.href}`} className="py-4">
              <span className="mr-2 inline-block rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{h.label}</span>
              <Link href={h.href} className="text-lg font-semibold text-accent hover:underline">
                {h.title}
              </Link>
              {h.summary && <p className="mt-1 text-muted">{h.summary}</p>}
            </li>
          ))}
        </ul>
      )}
      {result && result.hits.length > limit && (
        <p className="mt-4 text-sm text-muted">De eerste {limit} worden getoond; maak je zoekterm preciezer.</p>
      )}
    </section>
  );
}
