import Link from "next/link";
import { messagesFor, search, searchKinds, searchLooksAutomated, type ContentStore, type ContentTypeDefinition } from "@imprint/content-core";
import { publicMessages } from "./messages";

/**
 * The standard search page (content-core/search.ts): a form, a hint with
 * the prefixes the site's types offer, and the hits with their kind. A site
 * mounts it in its own chrome at `/search` and gives it the store of the
 * visitor at hand, so nobody sees what they may not. Styled with the token
 * classes every site's theme provides (architecture.md §3). With `log` (the
 * instance's user store) every search is counted for the admin's statistics:
 * the query and its hits, no person.
 */
export async function SearchPage({
  definitions,
  store,
  q,
  action = "/search",
  limit = 100,
  log,
  locale,
}: {
  /** The site's active content types; those with `search` take part. */
  definitions: ContentTypeDefinition[];
  store: ContentStore;
  q: string;
  action?: string;
  limit?: number;
  /** Where searches are counted (`imprint.users`); absent or null = not counted. */
  log?: { logSearch(query: string, hits: number, automated: boolean): Promise<void> } | null;
  /** The language of the fixed texts (`imprint.uiLocale`); absent = English. */
  locale?: string;
}) {
  const t = messagesFor(publicMessages, locale).search;
  const kinds = searchKinds(definitions);
  const result = q.trim() ? await search(definitions, store, q) : null;
  // Counting never breaks the page.
  if (result && log) await log.logSearch(q, result.hits.length, searchLooksAutomated(q)).catch(() => undefined);
  const examples = Object.entries(kinds).map(([kind, k]) => ({ kind, prefix: k.prefixes[0]!, label: k.label }));

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
      <form action={action} role="search" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          {t.term}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.placeholder}
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-accent px-5 py-2 font-semibold text-background hover:bg-accent-strong">
          {t.submit}
        </button>
      </form>
      {examples.length > 1 && (
        <p className="mt-3 text-sm text-muted">
          {t.tip}{" "}
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
          {t.results(result.hits.length)} {t.forQuery} “{q.trim()}”
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
        <p className="mt-4 text-sm text-muted">{t.firstShown(limit)}</p>
      )}
    </section>
  );
}
