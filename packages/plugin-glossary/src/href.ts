/**
 * Pure glossary helpers (no store imports: usable in client and server, and
 * in Node scripts such as an import).
 */

/** The URL space the plugin claims: `/term/<slug>`. */
export const TERM_PREFIX = "term";

export const termHref = (slug: string) => `/${TERM_PREFIX}/${slug}`;

/** Title → slug: lower case, diacritics off, the rest to hyphens. */
export function termSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "term"
  );
}

/** The card text: the summary, else the start of the text without Markdown. */
export function termSummary(term: { summary: string; body: string }, max = 280): string {
  const text = (term.summary || term.body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\\([\\`*_[\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}
