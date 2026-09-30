import type { ContentTypeDefinition } from "@imprint/content-core";
import { TermSchema } from "./schemas";

/** The plugin's content type: terms, edited with the generic form in the admin. */
export const glossaryContentTypes: ContentTypeDefinition[] = [
  {
    name: "term",
    schema: TermSchema,
    label: "Terms",
    flags: ["listable", "editable"],
    domain: "glossary",
    emptyData: () => ({ slug: "", lang: "en", access: "public", title: "", summary: "", body: "", tags: [] }),
  },
];
