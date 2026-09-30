/**
 * Pure group helpers (no store imports: usable in client and server, and in
 * Node scripts such as an import).
 */

/** The URL space the plugin claims: `/groups` (the overview) and `/groups/<slug>`. */
export const GROUPS_PREFIX = "groups";

export const groupsHref = () => `/${GROUPS_PREFIX}`;
export const groupHref = (slug: string) => `/${GROUPS_PREFIX}/${slug}`;

/** The slug prefix of a group's own pages: `groups/<slug>/<page>`. */
export const groupPagePrefix = (slug: string) => `${GROUPS_PREFIX}/${slug}/`;

/** Title → slug: lower case, diacritics off, the rest to hyphens. */
export function groupSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "group"
  );
}
