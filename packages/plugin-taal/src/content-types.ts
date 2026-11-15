import type { ContentTypeDefinition } from "@imprint/content-core";
import { GrammaticaSchema, LesFormSchema, LesSchema } from "./schemas";

/**
 * The plugin's content types, edited with the generic form in the admin:
 * lessons, and the grammar topics of the reference beside them. The key of a
 * lesson is its `id`; the recordings (`audio`) are not in the form, and the
 * form keeps what it does not show. The key of a topic is its `id` too
 * (`nl-tegenwoordige-tijd`), which is what a lesson's `grammatica` lists.
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
    emptyData: () => ({ id: "", slug: "", taal: "nl", steuntaal: "pl", fase: 0, module: "", titel: "", situatie: {}, dialoog: [], patroon: {}, brokken: [], oefeningen: [], ombouwen: "", grammatica: [] }),
  },
  {
    name: "grammatica",
    schema: GrammaticaSchema,
    label: "Grammatica",
    flags: ["listable", "editable"],
    domain: "taal",
    slugOf: (data) => String(data.id ?? ""),
    emptyData: () => ({ id: "", slug: "", taal: "nl", soort: "regel", groep: "werkwoorden", volgorde: 0, titel: { pl: "", nl: "" }, kort: {}, tekst: {}, anders: {} }),
  },
];
