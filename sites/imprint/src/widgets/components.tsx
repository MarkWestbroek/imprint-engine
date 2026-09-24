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
  album: standardViewers.album,
  divider: standardViewers.divider,
  quote: standardViewers.quote,
  code: standardViewers.code,
  mermaid: standardViewers.mermaid,
  v3model: standardViewers.v3model,
  tabs: standardViewers.tabs,
  cards: standardViewers.cards,
  buttons: standardViewers.buttons,
  logos: standardViewers.logos,
  toc: standardViewers.toc,
  breadcrumb: standardViewers.breadcrumb,
  file: standardViewers.file,
  pdf: standardViewers.pdf,
  timeline: standardViewers.timeline,
  mediatext: standardViewers.mediatext,
  people: standardViewers.people,
  testimonial: standardViewers.testimonial,
  pricing: standardViewers.pricing,
};
