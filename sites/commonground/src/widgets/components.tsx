import type { WidgetViewer, WidgetViewers } from "@imprint/runtime-admin";
import { standardViewers } from "@imprint/widgets-standard/viewers";
import { glossaryViewers } from "@imprint/plugin-glossary";
import { groupsViewers } from "@imprint/plugin-groups";
import { blogViewers } from "@imprint/plugin-blog";

/**
 * Widget type name → viewer, for every widget in ./registry.ts. Each viewer
 * is wrapped in a `data-widget` element, so the Common Ground look can style
 * per type (globals.css: text without the card frame, as on commonground.nl).
 */
const viewers: WidgetViewers = {
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
  embed: standardViewers.embed,
  video: standardViewers.video,
  ...glossaryViewers,
  ...groupsViewers,
  ...blogViewers,
};

function tagged(type: string, Viewer: WidgetViewer): WidgetViewer {
  const Tagged: WidgetViewer = (props) => (
    <div data-widget={type}>
      <Viewer {...props} />
    </div>
  );
  return Tagged;
}

export const widgetComponents: WidgetViewers = Object.fromEntries(
  Object.entries(viewers).map(([type, viewer]) => [type, tagged(type, viewer)])
);
