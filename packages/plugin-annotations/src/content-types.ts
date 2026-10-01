import type { ContentTypeDefinition } from "@imprint/content-core";
import { AnnotationSchema } from "./schemas";

/**
 * The plugin's content type. Listable in the admin for moderation; not
 * editable there (the thread is where annotations are written) and not in
 * site search (an annotation is read with its target, never on its own).
 */
export const annotationsContentTypes: ContentTypeDefinition[] = [
  {
    name: "annotation",
    schema: AnnotationSchema,
    label: "Annotations",
    flags: ["listable"],
    domain: "annotations",
  },
];
