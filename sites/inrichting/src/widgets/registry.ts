import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { standardWidgets } from "@imprint/widgets-standard/schemas";
import { omniumWidgets } from "@imprint/plugin-omnium/schemas";

/**
 * The widgets this site offers (architecture.md §3): the register widgets of
 * plugin-omnium, and a small set of standard widgets for explanation around
 * them (text, tables, diagrams). Schemas-only, so the ContentStore can
 * validate with it; the viewers pair up by name in ./components.tsx.
 */
export const widgetCatalog = [
  ...omniumWidgets,
  standardWidgets.hero,
  standardWidgets.text,
  standardWidgets.callout,
  standardWidgets.table,
  standardWidgets.accordion,
  standardWidgets.tabs,
  standardWidgets.cards,
  standardWidgets.buttons,
  standardWidgets.divider,
  standardWidgets.toc,
  standardWidgets.breadcrumb,
  standardWidgets.code,
  standardWidgets.mermaid,
  standardWidgets.v3model,
  standardWidgets.image,
  standardWidgets.embed,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
