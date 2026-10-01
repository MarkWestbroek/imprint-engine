import { itemsOf, plain, type ContentTypeDefinition } from "@imprint/content-core";
import { termHref } from "./href";
import { TermSchema, type Term } from "./schemas";

/** The plugin's content type: terms, edited with the generic form in the admin. */
export const glossaryContentTypes: ContentTypeDefinition[] = [
  {
    name: "term",
    schema: TermSchema,
    label: "Terms",
    flags: ["listable", "editable"],
    domain: "glossary",
    emptyData: () => ({ slug: "", lang: "en", access: "public", title: "", summary: "", body: "", tags: [] }),
    search: {
      kinds: { term: { label: "term", prefixes: ["term", "termen", "terms", "begrip", "begrippen"] } },
      docs: async (store) =>
        (await itemsOf<Term>(store, "term")).map((t) => ({
          kind: "term",
          href: termHref(t.slug),
          title: t.title,
          summary: plain(t.summary || t.body || ""),
          text: `${t.summary} ${t.body} ${(t.tags ?? []).join(" ")}`,
        })),
    },
  },
];
