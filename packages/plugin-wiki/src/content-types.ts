import type { ContentTypeDefinition } from "@imprint/content-core";
import { WikiFieldsSchema, WikiFolderSchema, WikiPageSchema, WikiSchema } from "./schemas";

/** The plugin's three content types, with the rules, starting data and form shapes that used to sit in the core. */
export const wikiContentTypes: ContentTypeDefinition[] = [
  {
    // Ingestable for wiki publishing (local → live): wiki → folders → pages.
    name: "wiki",
    schema: WikiSchema,
    formSchema: WikiFieldsSchema,
    label: "Wikis",
    flags: ["listable", "editable", "ingestable", "overview"],
    domain: "wiki",
    emptyData: () => ({ slug: "", lang: "en", title: "", description: "", access: "public", order: 0 }),
  },
  {
    name: "wiki-folder",
    schema: WikiFolderSchema,
    label: "Wiki folders",
    flags: ["listable", "editable", "ingestable"],
    domain: "wiki",
    relations: [
      { fromType: "wiki-folder", field: "wiki", toType: "wiki", enforce: true, label: "Wiki-folder → wiki" },
      { fromType: "wiki-folder", field: "parent", toType: "wiki-folder", enforce: true, label: "Wiki-folder → parent" },
    ],
    emptyData: () => ({ slug: "", lang: "en", wiki: "", parent: "", title: "", order: 0 }),
  },
  {
    name: "wiki-page",
    schema: WikiPageSchema,
    label: "Wiki pages",
    flags: ["listable", "editable", "ingestable"],
    domain: "wiki",
    relations: [
      { fromType: "wiki-page", field: "wiki", toType: "wiki", enforce: true, label: "Wiki-page → wiki" },
      { fromType: "wiki-page", field: "folder", toType: "wiki-folder", enforce: true, label: "Wiki-page → folder" },
    ],
    emptyData: () => ({ slug: "", lang: "en", wiki: "", folder: "", title: "", body: "", order: 0 }),
  },
];
