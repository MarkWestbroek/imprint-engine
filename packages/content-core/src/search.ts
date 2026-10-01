import type { ContentTypeDefinition } from "./content-types";
import type { ContentStore, WritableContentStore } from "./store";

/**
 * Site search (design/communities.md §9, backlog "zoeken naar de kern"):
 * every content type says how it is searched — `ContentTypeDefinition.search`
 * — and the engine does the rest: the prefixes people type (`community:
 * archi`, `blog: togaf`), the matching, the ranking. Reads through the store
 * it is given, so a visitor's store yields only what that visitor may see.
 * In memory: fine for thousands of items; an index comes when the volume asks.
 */

/** One searchable thing, as its type describes it. */
export type SearchDoc = {
  /** Which kind this is, out of the source's `kinds` (a type may split, e.g. posts into blog/news/update). */
  kind: string;
  href: string;
  title: string;
  /** Shown with the hit; plain text. */
  summary: string;
  /** Searched, not shown: everything that should match. */
  text: string;
};

export type SearchKind = {
  /** Shown with a hit ("community") and in counts; a singular noun. */
  label: string;
  /** What people type before the colon: "community", "groep", "group". Lower case. */
  prefixes: string[];
};

/** How a content type is searched: its kinds, and the documents it contributes. */
export type SearchSource = {
  kinds: Record<string, SearchKind>;
  docs(store: ContentStore): Promise<SearchDoc[]>;
};

export type SearchHit = SearchDoc & { label: string; score: number };

export type SearchResult = {
  hits: SearchHit[];
  /** The kind a prefix selected, or null for everything. */
  kind: string | null;
  terms: string[];
  /** Hits per kind, for a summary line. */
  counts: Record<string, number>;
};

export const normalise = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Every string inside a value, flattened — for a page's layout, a widget's texts. */
export function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
}

/** A summary without Markdown, cut at a word. */
export function plain(s: string, max = 160): string {
  const text = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

/** The items of a type through a store that can list (the writable one, or a guarded one made from it). */
export async function itemsOf<T>(store: ContentStore, type: string): Promise<T[]> {
  const listing = store as Partial<WritableContentStore>;
  if (typeof listing.listItems !== "function") return [];
  try {
    return (await listing.listItems(type)).map((r) => r.data as T);
  } catch {
    return []; // the store knows no such type
  }
}

/** All kinds the given types offer, with their labels and prefixes. */
export function searchKinds(definitions: ContentTypeDefinition[]): Record<string, SearchKind> {
  const kinds: Record<string, SearchKind> = {};
  for (const def of definitions) for (const [kind, k] of Object.entries(def.search?.kinds ?? {})) kinds[kind] = k;
  return kinds;
}

/** `community: archi` → the kind "group" and the terms ["archi"]; no known prefix → everything. */
export function parseQuery(q: string, kinds: Record<string, SearchKind>): { kind: string | null; terms: string[] } {
  const m = q.trim().match(/^([\p{L}]+)\s*:\s*(.*)$/u);
  const prefix = m ? normalise(m[1]!) : null;
  const kind = prefix ? (Object.entries(kinds).find(([, k]) => k.prefixes.includes(prefix))?.[0] ?? null) : null;
  const rest = m && kind ? m[2]! : q;
  return { kind, terms: normalise(rest).split(/\s+/).filter(Boolean) };
}

/**
 * Search the given types through `store`. Every term has to occur (in title
 * or text); hits in the title rank first, then a title that starts with a
 * term, then the rest, alphabetically.
 */
export async function search(definitions: ContentTypeDefinition[], store: ContentStore, q: string): Promise<SearchResult> {
  const kinds = searchKinds(definitions);
  const { kind, terms } = parseQuery(q, kinds);
  const counts: Record<string, number> = {};
  if (terms.length === 0 && !kind) return { hits: [], kind, terms, counts };
  const sources = definitions.filter((d) => d.search && (!kind || kind in d.search.kinds)).map((d) => d.search!);
  const docs = (await Promise.all(sources.map((s) => s.docs(store)))).flat().filter((d) => !kind || d.kind === kind);
  const hits: SearchHit[] = [];
  for (const d of docs) {
    const title = normalise(d.title);
    const hay = `${title} ${normalise(d.text)}`;
    if (!terms.every((t) => hay.includes(t))) continue;
    const inTitle = terms.filter((t) => title.includes(t)).length;
    const starts = terms.some((t) => title.startsWith(t)) ? 1 : 0;
    hits.push({ ...d, label: kinds[d.kind]?.label ?? d.kind, score: inTitle * 10 + starts * 5 });
    counts[d.kind] = (counts[d.kind] ?? 0) + 1;
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "nl"));
  return { hits, kind, terms, counts };
}
