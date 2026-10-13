import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { z } from "zod";
import { standardWidgets } from "@imprint/widgets-standard/schemas";
import { presentationWidgets } from "@imprint/plugin-presentations";

/** This site's own widget: the service-delivery animation (src/components/service-story.tsx). */
const serviceStory = {
  name: "dienstverlening",
  label: "Animatie: dienstverlening",
  version: "1.0.0",
  help: "Eén gegeven door het hele dienstverleningsproces, in drie lagen. Speelt vanzelf; de bezoeker kan wisselen tussen tekening en foto's.",
  configSchema: z.object({
    /** How the reality layer starts: a drawing, or photos of the real places. */
    stijl: z.enum(["tekening", "foto"]).default("tekening"),
  }),
};

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
  // The example form from Omnium, in an iframe (/modelleren/formulieren).
  standardWidgets.embed,
  serviceStory,
  ...presentationWidgets,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
