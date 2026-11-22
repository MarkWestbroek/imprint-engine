import { WidgetTypeRegistry, type WidgetTypeDef } from "@imprint/content-core";
import { z } from "zod";
import { standardWidgets } from "@imprint/widgets-standard/schemas";
import { blogWidgets } from "@imprint/plugin-blog";
import { glossaryWidgets } from "@imprint/plugin-glossary";

/**
 * This site's own widget: the derivation on the home page
 * (src/components/afleiding.tsx). One model drawn as a class, and what is
 * derived from it.
 */
const afleiding = {
  name: "afleiding",
  label: "Afleiding",
  version: "1.0.0",
  help: "Eén model, getekend als een klasse met attributen, en ernaast wat eruit wordt afgeleid: elk op een lijn vanaf het model. Een afgeleide met een URL is een link.",
  configSchema: z.object({
    kop: z.string().optional(),
    /** The heading is the title of the page (h1); otherwise a section heading (h2). */
    alsTitel: z.boolean().default(false),
    intro: z.string().optional(),
    model: z.object({
      /** Shown above the name between guillemets, e.g. "canoniek model". */
      stereotype: z.string().optional(),
      naam: z.string().min(1),
      attributen: z.array(z.string()).default([]),
    }),
    afgeleiden: z
      .array(
        z.object({
          /** Small mono label above the title, e.g. "OpenAPI". */
          label: z.string().optional(),
          titel: z.string().min(1),
          tekst: z.string().optional(),
          url: z.string().optional(),
        })
      )
      .default([]),
  }),
};

/**
 * The opening of the home page (src/components/doorbraak.tsx): the picture of
 * the brand, large on ink, with a heading, one line and one button.
 */
const doorbraak = {
  name: "doorbraak",
  label: "Doorbraak (opening)",
  version: "1.0.0",
  help: "De opening van de voorpagina: het beeld uit het logo groot op een donker vlak (de boog van de atmosfeer en de koers die erdoorheen breekt), met een kop, één regel en één knop. De kop is de titel van de pagina.",
  configSchema: z.object({
    kop: z.string().min(1),
    tekst: z.string().optional(),
    knopLabel: z.string().optional(),
    knopUrl: z.string().optional(),
    /** Small labels along the course: at its foot, on the arc, at the beacon. */
    labelVoet: z.string().optional(),
    labelBoog: z.string().optional(),
    labelBaken: z.string().optional(),
  }),
};

const punt = z.object({
  titel: z.string().min(1),
  tekst: z.string().optional(),
  /** The notation this aspect is modelled in, e.g. "UML". */
  notatie: z.string().optional(),
});

/**
 * Data, processes and rules as a triangle (src/components/drie-eenheid.tsx),
 * with along each side what the two have to do with each other, and around it
 * a ring with what surrounds that basis.
 */
const drieEenheid = {
  name: "drie-eenheid",
  label: "Drie-eenheid",
  version: "1.0.0",
  help: "Processen (boven), gegevens (linksonder) en regels (rechtsonder) als een gelijkzijdige driehoek, met langs elke zijde wat de twee met elkaar te maken hebben. Eromheen een ring met wat die basis omgeeft, met de klok mee vanaf boven; bij vijf: boven, rechtsboven, rechtsonder, linksonder, linksboven (bijvoorbeeld diensten, visie, externe regels, externe opgave, doelen). Lange namen komen op twee regels. Ernaast per aspect een korte tekst.",
  configSchema: z.object({
    kop: z.string().optional(),
    intro: z.string().optional(),
    gegevens: punt,
    processen: punt,
    regels: punt,
    verbandProcessenGegevens: z.string().optional(),
    verbandRegelsGegevens: z.string().optional(),
    verbandProcessenRegels: z.string().optional(),
    omgeving: z.array(z.string()).default([]),
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
  help: "Naam, e-mailadres en bericht; komt per mail bij de eigenaar van de site aan. Het adres staat nergens op de pagina. Labels en meldingen in het Nederlands of het Engels.",
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
    taal: z.enum(["nl", "en"]).default("nl"),
  }),
};

/**
 * The widgets this site offers (architecture.md §3): the opening, the triangle of data,
 * processes and rules, the derivation, the contact form, a selection from the standard library (with code and mermaid
 * for the knowledge pages), and the plugins' lists (latest posts, glossary).
 * Schemas-only, so the ContentStore can validate with it; the viewers pair up
 * by name in ./components.tsx.
 */
export const widgetCatalog = [
  standardWidgets.hero,
  standardWidgets.text,
  standardWidgets.specs,
  standardWidgets.table,
  standardWidgets.accordion,
  standardWidgets.callout,
  standardWidgets.image,
  standardWidgets.gallery,
  standardWidgets.video,
  standardWidgets.divider,
  standardWidgets.quote,
  standardWidgets.code,
  standardWidgets.mermaid,
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
  standardWidgets.embed,
  doorbraak,
  drieEenheid,
  afleiding,
  contact,
  ...blogWidgets,
  ...glossaryWidgets,
] as const;

export const widgetRegistry = widgetCatalog.reduce(
  // The catalogue is a heterogeneous tuple; each entry is a valid def on its own.
  (registry, def) => registry.register(def as WidgetTypeDef),
  new WidgetTypeRegistry()
);
