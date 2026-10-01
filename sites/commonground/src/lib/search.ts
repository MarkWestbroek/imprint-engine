import type { ContentStore, WritableContentStore } from "@imprint/content-core";
import { eventHref } from "@imprint/plugin-events/href";
import { groupHref } from "@imprint/plugin-groups/href";
import { postHref } from "@imprint/plugin-blog/href";
import { termHref } from "@imprint/plugin-glossary/href";
import { wikiPageHref } from "@imprint/plugin-wiki/href";
import type { WikiFolder, WikiPage } from "@imprint/plugin-wiki/schemas";

/**
 * Site search over everything the visitor may see: pages, posts (blog,
 * nieuws, update), events, communities, terms and wiki pages. A prefix
 * narrows it to one kind — `community: archi`, `blog: togaf`, `term: api` —
 * in Dutch or English. All in memory: the showcase has a few thousand items,
 * and the store only hands out what this visitor may read. A real index
 * comes with search in the core (backlog).
 */

export type Kind = "page" | "blog" | "news" | "update" | "event" | "group" | "term" | "wiki";

export type Hit = { kind: Kind; href: string; title: string; summary: string; score: number };

export const KIND_LABEL: Record<Kind, string> = {
  page: "pagina",
  blog: "blog",
  news: "nieuws",
  update: "update",
  event: "evenement",
  group: "community",
  term: "term",
  wiki: "wiki",
};

/** The words people type before a colon, mapped onto a kind. */
const PREFIXES: Record<string, Kind> = {
  page: "page", pagina: "page",
  blog: "blog", blogs: "blog",
  news: "news", nieuws: "news",
  update: "update", updates: "update",
  event: "event", events: "event", agenda: "event", evenement: "event",
  group: "group", groep: "group", groups: "group", groepen: "group", community: "group", communities: "group",
  term: "term", terms: "term", termen: "term", begrip: "term",
  wiki: "wiki",
};

export function parseQuery(q: string): { kind: Kind | null; terms: string[]; prefix: string | null } {
  const m = q.trim().match(/^([A-Za-z]+)\s*:\s*(.*)$/);
  const kind = m ? (PREFIXES[m[1]!.toLowerCase()] ?? null) : null;
  const rest = m && kind ? m[2]! : q;
  const terms = normalise(rest).split(/\s+/).filter(Boolean);
  return { kind, terms, prefix: m && kind ? m[1]!.toLowerCase() : null };
}

export const normalise = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Every string inside a value, flattened: widget texts, titles, captions. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
}

const cut = (s: string, max = 160) => {
  const text = s.replace(/[*_`>#|[\]()]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
};

type Candidate = { kind: Kind; href: string; title: string; summary: string; haystack: string };

async function listOf<T>(store: ContentStore, type: string): Promise<T[]> {
  const listing = store as Partial<WritableContentStore>;
  if (typeof listing.listItems !== "function") return [];
  try {
    return (await listing.listItems(type)).map((r) => r.data as T);
  } catch {
    return []; // the site has no such type
  }
}

/** Everything searchable, as the store's reader may see it. */
async function candidates(store: ContentStore, kinds: Set<Kind>): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const want = (k: Kind) => kinds.size === 0 || kinds.has(k);

  if (want("page")) {
    for (const p of await store.listPages()) {
      if (p.slug.startsWith("_")) continue;
      out.push({
        kind: "page",
        href: p.slug === "home" ? "/" : `/${p.slug}`,
        title: p.title,
        summary: cut(p.description || p.body || ""),
        haystack: `${p.title} ${p.description ?? ""} ${p.body ?? ""} ${textOf(p.layout)}`,
      });
    }
  }
  if (want("blog") || want("news") || want("update")) {
    type Post = { slug: string; title: string; summary: string; body: string; kind: Kind; author: string; tags: string[] };
    for (const p of await listOf<Post>(store, "post")) {
      const kind = (p.kind ?? "blog") as Kind;
      if (!want(kind)) continue;
      out.push({ kind, href: postHref(p.slug), title: p.title, summary: cut(p.summary || p.body), haystack: `${p.title} ${p.summary} ${p.body} ${p.author} ${(p.tags ?? []).join(" ")}` });
    }
  }
  if (want("event")) {
    type Ev = { slug: string; title: string; summary: string; body: string; location: string; start: string; tags: string[] };
    for (const e of await listOf<Ev>(store, "event")) {
      out.push({ kind: "event", href: eventHref(e.slug), title: e.title, summary: cut(`${e.start.slice(0, 10)} · ${e.location} · ${e.summary || e.body}`), haystack: `${e.title} ${e.summary} ${e.body} ${e.location} ${(e.tags ?? []).join(" ")}` });
    }
  }
  if (want("group")) {
    type Grp = { slug: string; title: string; summary: string; introduction: string; body: string; tags: string[] };
    for (const g of await listOf<Grp>(store, "group")) {
      out.push({ kind: "group", href: groupHref(g.slug), title: g.title, summary: cut(g.summary || g.introduction || g.body), haystack: `${g.title} ${g.summary} ${g.introduction} ${g.body} ${(g.tags ?? []).join(" ")}` });
    }
  }
  if (want("term")) {
    type Term = { slug: string; title: string; summary: string; body: string; tags: string[] };
    for (const t of await listOf<Term>(store, "term")) {
      out.push({ kind: "term", href: termHref(t.slug), title: t.title, summary: cut(t.summary || t.body), haystack: `${t.title} ${t.summary} ${t.body} ${(t.tags ?? []).join(" ")}` });
    }
  }
  if (want("wiki")) {
    const [pages, folders] = await Promise.all([listOf<WikiPage>(store, "wiki-page"), listOf<WikiFolder>(store, "wiki-folder")]);
    for (const p of pages) {
      out.push({ kind: "wiki", href: wikiPageHref(p, folders), title: p.title, summary: cut(p.body), haystack: `${p.title} ${p.body}` });
    }
  }
  return out;
}

export async function search(store: ContentStore, q: string): Promise<{ hits: Hit[]; kind: Kind | null; terms: string[] }> {
  const { kind, terms } = parseQuery(q);
  if (terms.length === 0 && !kind) return { hits: [], kind, terms };
  const list = await candidates(store, new Set(kind ? [kind] : []));
  const hits: Hit[] = [];
  for (const c of list) {
    const title = normalise(c.title);
    const hay = normalise(c.haystack);
    if (!terms.every((t) => hay.includes(t))) continue;
    // Title hits first, then a prefix of the title (what people type), then the rest.
    const inTitle = terms.filter((t) => title.includes(t)).length;
    const starts = terms.some((t) => title.startsWith(t)) ? 1 : 0;
    hits.push({ kind: c.kind, href: c.href, title: c.title, summary: c.summary, score: inTitle * 10 + starts * 5 });
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "nl"));
  return { hits, kind, terms };
}
