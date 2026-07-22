import type { WikiFolder, WikiPage } from "@imprint/content-core";

/**
 * Pure wiki-helpers (geen store-imports, dus bruikbaar in client én server —
 * de studio draait client-side). De lezende kant staat in lib/wiki.ts.
 */

/**
 * Canonieke URL van een wikipagina: /<wiki>/<folder-pad>/<pagina>. Opgelost
 * wordt er op het láátste segment (paginaslug, uniek binnen de wiki) — een
 * verplaatste pagina breekt oude links dus niet; de folderketen in de URL is
 * cosmetisch.
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

/** Titel → slug: kleine letters, diacrieten weg, rest naar streepjes. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs zijn globaal per type; de studio scopet ze per wiki door te
 * prefixen met de wiki-slug en bij botsing te nummeren (-2, -3, …).
 */
export function scopedSlug(wiki: string, title: string, taken: Set<string>): string {
  const base = `${wiki}-${slugify(title)}`.replace(/-+$/, "") || `${wiki}-item`;
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}
