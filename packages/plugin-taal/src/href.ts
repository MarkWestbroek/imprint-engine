/**
 * The addresses of the language training (pure: client, server and Node
 * scripts). `/<ui>/<pakket>/<les>`: the first segment is the language of the
 * interface (design/meertaligheid.md, layer 4), the second the lesson package,
 * named after the language it teaches, in that language.
 *
 *   /pl/nederlands/dit-en-dat   Polish interface, the Dutch package
 */

/** Language taught → the name of its package in the address. */
export const PAKKETTEN: Record<string, string> = { nl: "nederlands", pl: "polski", it: "italiano", de: "deutsch" };

export const pakketNaam = (taal: string): string => PAKKETTEN[taal] ?? taal;

/** The language a package name stands for, or null. */
export const pakketTaal = (naam: string): string | null =>
  Object.entries(PAKKETTEN).find(([, n]) => n === naam)?.[0] ?? null;

export const pakketHref = (ui: string, taal: string): string => `/${ui}/${pakketNaam(taal)}`;

/** The name of a lesson in the address: its slug, else its id. */
export const lesSlug = (les: { id: string; slug?: string }): string => les.slug || les.id;

export const lesHref = (ui: string, les: { id: string; slug?: string; taal: string }): string =>
  `${pakketHref(ui, les.taal)}/${lesSlug(les)}`;

/** A file name (`01-dit-en-dat.md`) → the slug of the lesson (`dit-en-dat`). */
export const slugFromFile = (file: string): string =>
  file
    .replace(/^.*[\\/]/, "")
    .replace(/\.md$/, "")
    .replace(/^\d+-/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
