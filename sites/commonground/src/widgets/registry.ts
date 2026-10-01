import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { standardWidgets } from "@imprint/widgets-standard/schemas";
import { glossaryWidgets } from "@imprint/plugin-glossary";
import { groupsWidgets } from "@imprint/plugin-groups";
import { blogWidgets } from "@imprint/plugin-blog";

/**
 * The widgets this site offers (architecture.md §3): a selection from the
 * standard library that covers what the Pleio pages of commonground.nl use
 * (scripts/import-pleio.ts maps their widgets onto these). Schemas-only, so the ContentStore can
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
  standardWidgets.quote,
  standardWidgets.code,
  standardWidgets.mermaid,
  standardWidgets.v3model,
  standardWidgets.tabs,
  standardWidgets.cards,
  standardWidgets.buttons,
  standardWidgets.logos,
  standardWidgets.toc,
  standardWidgets.breadcrumb,
  standardWidgets.file,
  standardWidgets.pdf,
  standardWidgets.timeline,
  standardWidgets.mediatext,
  standardWidgets.people,
  standardWidgets.testimonial,
  standardWidgets.pricing,
  // Pleio pages embed iframes (html widget) and YouTube videos.
  standardWidgets.embed,
  standardWidgets.video,
  // The terms overview (plugin-glossary): Pleio's "Termen" and "Afkortingen" pages.
  ...glossaryWidgets,
  // The communities overview (plugin-groups): Pleio's "Onze communities".
  ...groupsWidgets,
  // The latest blog posts (plugin-blog): Pleio's blog lists.
  ...blogWidgets,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
