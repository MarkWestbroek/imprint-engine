import type { WidgetViewers } from "@imprint/runtime-admin";
import { standardViewers } from "@imprint/widgets-standard/viewers";
import { omniumViewers } from "@imprint/plugin-omnium";

/** Widget type name → viewer, for every widget in ./registry.ts. */
export const widgetComponents: WidgetViewers = {
  ...omniumViewers,
  hero: standardViewers.hero,
  text: standardViewers.text,
  callout: standardViewers.callout,
  table: standardViewers.table,
  accordion: standardViewers.accordion,
  tabs: standardViewers.tabs,
  cards: standardViewers.cards,
  buttons: standardViewers.buttons,
  divider: standardViewers.divider,
  toc: standardViewers.toc,
  breadcrumb: standardViewers.breadcrumb,
  code: standardViewers.code,
  mermaid: standardViewers.mermaid,
  v3model: standardViewers.v3model,
  image: standardViewers.image,
  embed: standardViewers.embed,
};
