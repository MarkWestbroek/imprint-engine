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

/**
 * Whether a search query looks typed by a machine (site statistics leave it
 * out): a scanner's marker (a run of 6–12 letters in mixed case, no vowel
 * pattern a word has, like `XzZnWQWF`), a path or injection probe
 * (`../`, `/etc/passwd`, `web.xml`, `system.ini`, `<script`, `union select`,
 * `${`, `%00`), or something no person types into a search box (over 120
 * characters). Pure, so the rule is testable and the same everywhere.
 */
export function searchLooksAutomated(query: string): boolean {
  const q = query.trim();
  if (q.length > 120) return true;
  if (/(\.\.[\/\\]|[\/\\]etc[\/\\]|passwd|web-inf|web\.xml|system\.ini|win\.ini|boot\.ini|<\s*script|javascript:|onerror\s*=|union\s+select|\bselect\s.+\bfrom\b|sleep\s*\(|\$\{|\{\{|%00|%2e%2e|\bor\s+1\s*=\s*1)/i.test(q)) return true;
  if (/^[A-Za-z]{6,12}$/.test(q)) {
    const upper = (q.match(/[A-Z]/g) ?? []).length;
    const lower = q.length - upper;
    // Mixed case beyond a capital first letter, an acronym or one CamelCase hump: "XzZnWQWF", "sPbkyDhN",
    // "TlqgUPWm" (capitals after a small letter); not "Fieldlab", "VNG", "VNGrealisatie", "OpenZaak".
    const humps = (q.slice(1).match(/[a-z][A-Z]/g) ?? []).length;
    // Also a capital run, small letters, and a capital again ("ATyqaVkj"), or more capitals than small ones
    // ending in small letters ("FNEGQAqo").
    const odd = /^[a-z]/.test(q) || /[a-z][A-Z]{2,}/.test(q) || /^[A-Z]{2,}[a-z]+[A-Z]/.test(q) || (upper > lower && /[a-z]$/.test(q));
    if (upper >= 2 && lower >= 2 && (humps >= 2 || odd)) return true;
    // One small letter hidden among capitals: "PTtEMIQE", "XHGFzLTK". (Eight capitals alone may be a person shouting.)
    if (upper >= 5 && lower === 1 && /[A-Z][a-z][A-Z]/.test(q)) return true;
  }
  return false;
}
