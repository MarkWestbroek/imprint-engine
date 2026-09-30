import type { ContentTypeDefinition } from "@imprint/content-core";
import { GroupSchema } from "./schemas";

/** The plugin's content type: groups, edited with the generic form in the admin. */
export const groupsContentTypes: ContentTypeDefinition[] = [
  {
    name: "group",
    schema: GroupSchema,
    label: "Groups",
    flags: ["listable", "editable"],
    domain: "groups",
    relations: [{ fromType: "group", field: "wiki", toType: "wiki", enforce: true, label: "Group → wiki" }],
    emptyData: () => ({
      slug: "",
      lang: "en",
      access: "public",
      title: "",
      summary: "",
      introduction: "",
      body: "",
      tags: [],
      closed: false,
      membershipOnRequest: false,
      wiki: "",
      order: 0,
    }),
  },
];
