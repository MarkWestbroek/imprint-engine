import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { z } from "zod";
import { standardWidgets } from "@imprint/widgets-standard/schemas";

/**
 * This site's own widget: the patchbay on the home page
 * (src/components/patchbay.tsx). One source module, and per activity a module
 * with a patch cable to it.
 */
const patchbay = {
  name: "patchbay",
  label: "Patchbay",
  version: "1.0.0",
  help: "Een rack: links de bron, daarnaast per activiteit een module met een patchkabel ernaartoe. De kabels bewegen; een module met een URL is een link.",
  configSchema: z.object({
    /** Heading above the rack (the page's h1). */
    kop: z.string().optional(),
    intro: z.string().optional(),
    /** The name on the source module. */
    naam: z.string().min(1),
    /** Small line under the name. */
    regel: z.string().optional(),
    modules: z
      .array(
        z.object({
          titel: z.string().min(1),
          tekst: z.string().optional(),
          /** Where the module leads; without it the module is not a link. */
          url: z.string().optional(),
          /** The address as shown on the module, e.g. "paratmos.nl". */
          adres: z.string().optional(),
          /** Label beside the output jack on the source: a few capitals. */
          jack: z.string().min(1).max(6),
          kleur: z.enum(["oranje", "blauw", "geel", "roze"]).default("oranje"),
        })
      )
      .default([]),
  }),
};

/**
 * A contact form (src/components/contact-form.tsx): the message is mailed to
 * the owner (CONTACT_TO on the server), so no address has to be on the site.
 */
const contact = {
  name: "contact",
  label: "Contactformulier",
  version: "1.0.0",
  help: "Naam, e-mailadres en bericht; komt per mail bij de eigenaar van de site aan. Het adres staat nergens op de pagina. Labels en meldingen in het Nederlands of het Pools.",
  configSchema: z.object({
    title: z.string().default("Contact"),
    /** Markdown above the form. */
    intro: z.string().optional(),
    /** The id to link to, as in a button to "#contact". */
    anker: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .default("contact"),
    /** The language of the labels and messages; the section is marked with it (`lang`). */
    taal: z.enum(["nl", "pl"]).default("nl"),
  }),
};

/**
 * The widgets this site offers (architecture.md §3): the patchbay, and a
 * selection from the standard library for the pages behind it. Schemas-only,
 * so the ContentStore can validate with it; the viewers pair up by name in
 * ./components.tsx.
 */
export const widgetCatalog = [
  standardWidgets.hero,
  standardWidgets.text,
  standardWidgets.table,
  standardWidgets.accordion,
  standardWidgets.callout,
  standardWidgets.image,
  standardWidgets.gallery,
  standardWidgets.carousel,
  standardWidgets.album,
  standardWidgets.video,
  standardWidgets.audio,
  standardWidgets.divider,
  standardWidgets.quote,
  standardWidgets.tabs,
  standardWidgets.cards,
  standardWidgets.buttons,
  standardWidgets.toc,
  standardWidgets.breadcrumb,
  standardWidgets.file,
  standardWidgets.pdf,
  standardWidgets.timeline,
  standardWidgets.mediatext,
  standardWidgets.people,
  standardWidgets.embed,
  patchbay,
  contact,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
