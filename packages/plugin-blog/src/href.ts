/** Pure blog helpers (no store imports: usable in client, server and Node scripts). */

/** The URL space the plugin claims: `/blog` (the overview) and `/blog/<slug>`. */
export const BLOG_PREFIX = "blog";

export const blogHref = () => `/${BLOG_PREFIX}`;
export const postHref = (slug: string) => `/${BLOG_PREFIX}/${slug}`;

/** Title → slug: lower case, diacritics off, the rest to hyphens. */
export function postSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

/** The list text: the summary, else the start of the text without Markdown. */
export function postSummary(post: { summary: string; body: string }, max = 220): string {
  const text = (post.summary || post.body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\\([\\`*_[\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

/** "3 oktober 2026" for a YYYY-MM-DD date. */
export function formatDate(iso: string, locale = "nl-NL"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
