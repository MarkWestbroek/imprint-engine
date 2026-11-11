import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { standardWidgets } from "@imprint/widgets-standard/schemas";
import { taalWidgets } from "@imprint/plugin-taal";

/**
 * The widgets this site offers (architecture.md §3): a small selection from
 * the standard library for the pages around the lessons, plus the two lesson
 * widgets of plugin-taal. Schemas-only, so the ContentStore can validate with
 * it; the viewers pair up by name in ./components.tsx.
 */
export const widgetCatalog = [
  standardWidgets.hero,
  standardWidgets.text,
  standardWidgets.callout,
  standardWidgets.image,
  standardWidgets.divider,
  standardWidgets.quote,
  standardWidgets.table,
  standardWidgets.accordion,
  standardWidgets.cards,
  standardWidgets.buttons,
  standardWidgets.audio,
  ...taalWidgets,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
