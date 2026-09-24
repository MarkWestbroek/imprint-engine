import type { WritableContentStore } from "@imprint/content-core";
import { WikiFolderSchema, WikiPageSchema, WikiSchema, type Wiki, type WikiFolder, type WikiPage } from "./schemas";

/**
 * Reading side of the wiki (design/wiki.md §3): the tree query. Wikis are
 * database content (no file-store variant); the caller hands in the store
 * (the unguarded write side: the route decides who sees what). Pure URL
 * helpers live in href.ts.
 */

const byOrder = <T extends { order: number; title: string }>(a: T, b: T) =>
  a.order - b.order || a.title.localeCompare(b.title);

export async function getWiki(store: WritableContentStore, slug: string): Promise<Wiki | null> {
  // Language-tolerant: a wiki is not multilingual (yet), so match on the slug
  // whatever the lang — otherwise a wiki created with lang=nl 404s, because
  // getItem looks for "en" by default.
  const items = await store.listItems("wiki");
  const matches = items.filter((i) => i.slug === slug);
  const preferred = matches.find((i) => i.lang === "en") ?? matches[0];
  if (!preferred) return null;
  const parsed = WikiSchema.safeParse(preferred.data);
  return parsed.success ? parsed.data : null;
}

export async function listWikis(store: WritableContentStore): Promise<Wiki[]> {
  const items = await store.listItems("wiki");
  return items
    .flatMap((i) => {
      const parsed = WikiSchema.safeParse(i.data);
      return parsed.success ? [parsed.data] : [];
    })
    .sort(byOrder);
}

export type WikiTree = { folders: WikiFolder[]; pages: WikiPage[] };

/** All folders + pages of one wiki, sorted (order, then title). */
export async function getWikiTree(store: WritableContentStore, wiki: string): Promise<WikiTree> {
  const [folderItems, pageItems] = await Promise.all([store.listItems("wiki-folder"), store.listItems("wiki-page")]);
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
