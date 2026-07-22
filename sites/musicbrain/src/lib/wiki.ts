import {
  WikiSchema,
  WikiFolderSchema,
  WikiPageSchema,
  type Wiki,
  type WikiFolder,
  type WikiPage,
} from "@imprint/content-core";
import { writableStore } from "@/lib/content";

/**
 * Leeskant van de wiki (design/wiki.md §3): boom-query + canonieke URL's.
 * Wiki's zijn DB-content (geen file-store-variant); zonder DATABASE_URL —
 * v0/CI — bestaan er simpelweg geen wiki's en valt de route door naar 404.
 */

const byOrder = <T extends { order: number; title: string }>(a: T, b: T) =>
  a.order - b.order || a.title.localeCompare(b.title);

export async function getWiki(slug: string): Promise<Wiki | null> {
  if (!writableStore) return null;
  // Taal-tolerant: een wiki is (nog) niet meertalig, dus we matchen op slug
  // ongeacht lang — anders 404't een met lang=nl aangemaakte wiki, omdat
  // getItem standaard op "en" zoekt. Echte meertaligheid volgt later het
  // design/meertaligheid.md-mechanisme.
  const items = await writableStore.listItems("wiki");
  const matches = items.filter((i) => i.slug === slug);
  const preferred = matches.find((i) => i.lang === "en") ?? matches[0];
  if (!preferred) return null;
  const parsed = WikiSchema.safeParse(preferred.data);
  return parsed.success ? parsed.data : null;
}

export async function listWikis(): Promise<Wiki[]> {
  if (!writableStore) return [];
  const items = await writableStore.listItems("wiki");
  return items
    .flatMap((i) => {
      const parsed = WikiSchema.safeParse(i.data);
      return parsed.success ? [parsed.data] : [];
    })
    .sort(byOrder);
}

export type WikiTree = { folders: WikiFolder[]; pages: WikiPage[] };

/** All folders + pages of one wiki, sorted (order, then title). */
export async function getWikiTree(wiki: string): Promise<WikiTree> {
  if (!writableStore) return { folders: [], pages: [] };
  const [folderItems, pageItems] = await Promise.all([
    writableStore.listItems("wiki-folder"),
    writableStore.listItems("wiki-page"),
  ]);
  const folders = folderItems
    .flatMap((i) => {
      const parsed = WikiFolderSchema.safeParse(i.data);
      return parsed.success && parsed.data.wiki === wiki ? [parsed.data] : [];
    })
    .sort(byOrder);
  const pages = pageItems
    .flatMap((i) => {
      const parsed = WikiPageSchema.safeParse(i.data);
      return parsed.success && parsed.data.wiki === wiki ? [parsed.data] : [];
    })
    .sort(byOrder);
  return { folders, pages };
}

/**
 * Canonieke URL van een wikipagina: /<wiki>/<folder-pad>/<pagina>. Opgelost
 * wordt er op het láátste segment (paginaslug, uniek binnen de wiki) — een
 * verplaatste pagina breekt oude links dus niet, de URL is alleen cosmetisch
 * de folderketen.
 */
export function wikiPageHref(page: WikiPage, folders: WikiFolder[]): string {
  const byName = new Map(folders.map((f) => [f.slug, f]));
  const chain: string[] = [];
  let cursor = byName.get(page.folder);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.slug)) {
    seen.add(cursor.slug);
    chain.unshift(cursor.slug);
    cursor = cursor.parent ? byName.get(cursor.parent) : undefined;
  }
  return `/${[page.wiki, ...chain, page.slug].join("/")}`;
}
