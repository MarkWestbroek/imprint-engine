/** URLs of the pool, framework-free (Node scripts and the site share them). */
export const PATCHES_PREFIX = "patches";
export const patchesHref = () => `/${PATCHES_PREFIX}`;
export const labHref = () => `/${PATCHES_PREFIX}/lab`;
export const questionsHref = () => `/${PATCHES_PREFIX}/vragen`;
export const patchHref = (slug: string) => `/${PATCHES_PREFIX}/${slug}`;

/** The reserved second segments: not patch slugs. */
export const RESERVED = new Set(["lab", "vragen"]);

/** A title → a slug: lowercase ascii, dashes. */
export function patchSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
