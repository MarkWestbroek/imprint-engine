import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { standardWidgets } from "@imprint/widgets-standard/schemas";

/**
 * The widgets this site offers (architecture.md §3): a deliberate, small
 * selection from the standard library — enough for a product site, and none
 * of MusicBrain's domain widgets. Schemas-only, so the ContentStore can
 * validate with it; the viewers pair up by name in ./components.tsx.
 */
export const widgetCatalog = [
  standardWidgets.hero,
  standardWidgets.text,
  standardWidgets.specs,
  standardWidgets.table,
  standardWidgets.accordion,
  standardWidgets.callout,
  standardWidgets.image,
  standardWidgets.album,
  standardWidgets.divider,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
