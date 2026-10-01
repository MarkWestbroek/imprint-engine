import { itemsOf, plain, type ContentTypeDefinition } from "@imprint/content-core";
import { postHref } from "./href";
import { PostSchema, type Post } from "./schemas";

/** The plugin's content type: posts, edited with the generic form in the admin. */
export const blogContentTypes: ContentTypeDefinition[] = [
  {
    name: "post",
    schema: PostSchema,
    label: "Posts",
    flags: ["listable", "editable"],
    domain: "blog",
    relations: [{ fromType: "post", field: "group", toType: "group", enforce: true, label: "Post → group" }],
    search: {
      kinds: {
        blog: { label: "blog", prefixes: ["blog", "blogs"] },
        news: { label: "nieuws", prefixes: ["nieuws", "news"] },
        update: { label: "update", prefixes: ["update", "updates"] },
      },
      docs: async (store) =>
        (await itemsOf<Post>(store, "post")).map((p) => ({
          kind: p.kind ?? "blog",
          href: postHref(p.slug),
          title: p.title,
          summary: plain(p.summary || p.body || ""),
          text: `${p.summary} ${p.body} ${p.author} ${(p.tags ?? []).join(" ")}`,
        })),
    },
    emptyData: () => ({
      slug: "",
      lang: "en",
      access: "public",
      title: "",
      summary: "",
      body: "",
      author: "",
      publishedAt: new Date().toISOString().slice(0, 10),
      tags: [],
      group: "",
    }),
  },
];
