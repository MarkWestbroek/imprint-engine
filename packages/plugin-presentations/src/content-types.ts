import type { ContentTypeDefinition } from "@imprint/content-core";
import { PresentationSchema } from "./schemas";

/** The plugin's content type: presentations, edited with the generic form in the admin (notes included). */
export const presentationsContentTypes: ContentTypeDefinition[] = [
  {
    name: "presentation",
    schema: PresentationSchema,
    label: "Presentations",
    flags: ["listable", "editable"],
    domain: "presentations",
    emptyData: () => ({ slug: "", lang: "en", access: "public", title: "", description: "", sections: [], faces: [], slides: [] }),
  },
];
