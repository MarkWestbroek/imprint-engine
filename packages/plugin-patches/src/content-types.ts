import { itemsOf, plain, type ContentTypeDefinition } from "@imprint/content-core";
import { labHref, patchHref, patchesHref, questionsHref } from "./href";
import { PatchFormSchema, PatchSchema, type Patch } from "./schemas";

/**
 * The plugin's content type. Moderation is the generic form: Mark changes
 * `pool` (the schema refuses `centraal` without CC0) and listens on the
 * patch's own page. `derivedFrom` is a relation rule, so a family tree never
 * points at nothing. Search splits the pool into three kinds.
 */
export const patchesContentTypes: ContentTypeDefinition[] = [
  {
    name: "patch",
    schema: PatchSchema,
    formSchema: PatchFormSchema,
    label: "Patches",
    flags: ["listable", "editable"],
    domain: "catalogus",
    relations: [{ fromType: "patch", field: "derivedFrom", toType: "patch", enforce: true, label: "patch is afgeleid van patch" }],
    emptyData: () => ({
      slug: "",
      lang: "en",
      title: "",
      description: "",
      pool: "experimenteel",
      author: "",
      tags: [],
      file: "",
      takes: [],
      requires: { editorVersion: "0.0.0", firmwareContract: "0.0.0", moduleTypes: [] },
      license: "CC-BY-4.0",
      answered: false,
    }),
    search: {
      kinds: {
        patch: { label: "patch", prefixes: ["patch", "patches"] },
        lab: { label: "lab-patch", prefixes: ["lab"] },
        vraag: { label: "vraag", prefixes: ["vraag", "vragen", "question"] },
      },
      docs: async (store) =>
        (await itemsOf<Patch>(store, "patch"))
          .filter((p) => p.pool !== "voorstel")
          .map((p) => ({
            kind: p.pool === "centraal" ? "patch" : p.pool === "experimenteel" ? "lab" : "vraag",
            href: patchHref(p.slug),
            title: p.title,
            summary: plain(p.description || p.question || ""),
            // Module types too, so "sid" or "ladder" finds the patches that use them.
            text: `${p.description} ${p.question ?? ""} ${p.tags.join(" ")} ${p.requires.moduleTypes.join(" ")} ${p.author}`,
          })),
    },
  },
];

export { labHref, patchesHref, questionsHref };
