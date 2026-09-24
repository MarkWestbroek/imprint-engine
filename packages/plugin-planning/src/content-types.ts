import type { ContentTypeDefinition } from "@imprint/content-core";
import { PlanningItemSchema, PlanningSchema } from "./schemas";

/** The plugin's two content types, with the rules and starting data that used to sit in the core. */
export const planningContentTypes: ContentTypeDefinition[] = [
  {
    // Boards have their own screens (/admin/planning); cards are saved through the plugin's actions.
    name: "planning",
    schema: PlanningSchema,
    label: "Planning",
    flags: ["overview"],
    domain: "planning",
    relations: [
      { fromType: "planning", field: "product", toType: "product", enforce: true, label: "Planning → product" },
    ],
    emptyData: () => ({
      slug: "", lang: "en", name: "", product: "", description: "",
      phases: [
        { key: "backlog", label: "Backlog", order: 0 },
        { key: "in-progress", label: "In progress", order: 1 },
        { key: "beta", label: "Beta", order: 2 },
        { key: "done", label: "Done", order: 3 },
      ],
      order: 0,
    }),
  },
  {
    name: "planning-item",
    schema: PlanningItemSchema,
    label: "Planning items",
    flags: ["listable"],
    domain: "planning",
    relations: [
      { fromType: "planning-item", field: "planning", toType: "planning", enforce: true, label: "Planning-item → planning" },
      { fromType: "planning-item", field: "component", toType: "component", enforce: true, label: "Planning-item → component" },
    ],
    emptyData: () => ({ slug: "", lang: "en", title: "", planning: "", status: "backlog", owner: "", body: "", order: 0 }),
  },
];
