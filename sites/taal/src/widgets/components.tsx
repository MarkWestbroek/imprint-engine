import type { WidgetViewers } from "@imprint/runtime-admin";
import { standardViewers } from "@imprint/widgets-standard/viewers";
import { taalViewers } from "@imprint/plugin-taal";

/** Widget type name → viewer, for every widget in ./registry.ts. */
export const widgetComponents: WidgetViewers = {
  hero: standardViewers.hero,
  text: standardViewers.text,
  callout: standardViewers.callout,
  image: standardViewers.image,
  divider: standardViewers.divider,
  quote: standardViewers.quote,
  table: standardViewers.table,
  accordion: standardViewers.accordion,
  cards: standardViewers.cards,
  buttons: standardViewers.buttons,
  audio: standardViewers.audio,
  ...taalViewers,
};
