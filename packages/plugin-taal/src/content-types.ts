import type { ContentTypeDefinition } from "@imprint/content-core";
import { LesFormSchema, LesSchema } from "./schemas";

/**
 * The plugin's content type: lessons, edited with the generic form in the
 * admin. The key of a lesson is its `id`; the recordings (`audio`) are not in
 * the form, and the form keeps what it does not show.
 */
export const taalContentTypes: ContentTypeDefinition[] = [
  {
    name: "les",
    schema: LesSchema,
    formSchema: LesFormSchema,
    label: "Lessen",
    flags: ["listable", "editable"],
    domain: "taal",
    slugOf: (data) => String(data.id ?? ""),
    emptyData: () => ({ id: "", slug: "", taal: "nl", steuntaal: "pl", fase: 0, module: "", titel: "", situatie: {}, dialoog: [], patroon: {}, brokken: [], oefeningen: [], ombouwen: "" }),
  },
];
