import type { WidgetViewers } from "@imprint/runtime-admin";
import { standardViewers } from "@imprint/widgets-standard/viewers";

/** Widget type name → viewer, for every widget in ./registry.ts. */
export const widgetComponents: WidgetViewers = {
  hero: standardViewers.hero,
  text: standardViewers.text,
  specs: standardViewers.specs,
  table: standardViewers.table,
  accordion: standardViewers.accordion,
  callout: standardViewers.callout,
  image: standardViewers.image,
  divider: standardViewers.divider,
};
