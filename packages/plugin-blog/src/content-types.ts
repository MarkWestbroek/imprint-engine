import type { ContentTypeDefinition } from "@imprint/content-core";
import { PostSchema } from "./schemas";

/** The plugin's content type: posts, edited with the generic form in the admin. */
export const blogContentTypes: ContentTypeDefinition[] = [
  {
    name: "post",
    schema: PostSchema,
    label: "Posts",
    flags: ["listable", "editable"],
    domain: "blog",
    relations: [{ fromType: "post", field: "group", toType: "group", enforce: true, label: "Post → group" }],
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
