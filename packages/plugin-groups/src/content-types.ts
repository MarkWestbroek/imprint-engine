import { itemsOf, plain, type ContentTypeDefinition } from "@imprint/content-core";
import { groupHref } from "./href";
import { GroupSchema, type Group } from "./schemas";

/** The plugin's content type: groups, edited with the generic form in the admin. */
export const groupsContentTypes: ContentTypeDefinition[] = [
  {
    name: "group",
    schema: GroupSchema,
    label: "Groups",
    flags: ["listable", "editable"],
    domain: "groups",
    relations: [{ fromType: "group", field: "wiki", toType: "wiki", enforce: true, label: "Group → wiki" }],
    search: {
      kinds: { group: { label: "community", prefixes: ["community", "communities", "groep", "groepen", "group", "groups"] } },
      docs: async (store) =>
        (await itemsOf<Group>(store, "group")).map((g) => ({
          kind: "group",
          href: groupHref(g.slug),
          title: g.title,
          summary: plain(g.summary || g.introduction || g.body || ""),
          text: `${g.summary} ${g.introduction} ${g.body} ${(g.tags ?? []).join(" ")}`,
        })),
    },
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
