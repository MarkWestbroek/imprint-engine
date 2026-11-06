import { z } from "zod";
import { PADS, type Pad } from "./inrichting";

/**
 * The widgets' config schemas (React-free: the site's registry and the store
 * validate with them). The studio builds their forms from these.
 */

const pads = PADS as [Pad, ...Pad[]];

export const OmniumLijstConfig = z.object({
  title: z.string().optional(),
  /** The records of one type (e.g. ediensten for an overview). */
  pad: z.enum(pads).optional(),
  /**
   * With `pad`, on a template: only the records whose relation of this name
   * points at the page's record — e.g. `artefact_edienstversies` lists the
   * artefacts of the version on screen.
   */
  koppeling: z.string().default(""),
  /**
   * Without `pad`, on a template: a list inside the page's record — a
   * meervoudig gegevenselement (`artefact_traceregels`) or a relation with
   * fields (`uitrol_resultaten`, linking to the artefact).
   */
  veld: z.string().default(""),
  /** With `pad: artefacten`: only results (`gegenereerd`), sources (`bron`, each with its drawings) or drawings (`weergave`). */
  richting: z.enum(["", "gegenereerd", "bron", "weergave"]).default(""),
  /**
   * With `pad: artefacten`: one block per target component, in the order of the
   * chain (Open Formulieren, Open Object, Open Zaak, GZAC, then the rest), and
   * within a block processes and decisions before the rest.
   */
  groepeer: z.enum(["", "component"]).default(""),
  leeg: z.string().default("Niets gevonden."),
});
export type OmniumLijstConfig = z.infer<typeof OmniumLijstConfig>;

export const OmniumDetailConfig = z.object({
  title: z.string().optional(),
  /** Gegevenselementen and relations to leave out, comma-separated json names (`artefact_inhouden`). */
  verberg: z.string().default(""),
});
export type OmniumDetailConfig = z.infer<typeof OmniumDetailConfig>;

export const OmniumFormulierConfig = z.object({
  title: z.string().optional(),
});
export type OmniumFormulierConfig = z.infer<typeof OmniumFormulierConfig>;

export const OmniumBeslistabelConfig = z.object({
  title: z.string().optional(),
});
export type OmniumBeslistabelConfig = z.infer<typeof OmniumBeslistabelConfig>;

export const OmniumTekeningConfig = z.object({
  title: z.string().optional(),
});
export type OmniumTekeningConfig = z.infer<typeof OmniumTekeningConfig>;

/** For the site's catalogue (`src/widgets/registry.ts`). */
export const omniumWidgets = [
  {
    name: "omnium-lijst",
    label: "Omnium: lijst",
    version: "1.0.0",
    help: "A table from the Omnium register: all records of a type, those linked to the page's record, or a list inside it (traceregels, uitrolresultaten). Rows link to their page.",
    configSchema: OmniumLijstConfig,
  },
  {
    name: "omnium-detail",
    label: "Omnium: gegevens",
    version: "1.0.0",
    help: "The page's register record: its gegevenselementen and relations, as the register holds them now (or at the chosen moment).",
    configSchema: OmniumDetailConfig,
  },
  {
    name: "omnium-formulier",
    label: "Omnium: formulier",
    version: "1.0.0",
    help: "An Open Formulieren form of the page's artefact as an overview: per step the questions, where each comes from in the model and where it goes in the objecttype, plus the logic.",
    configSchema: OmniumFormulierConfig,
  },
  {
    name: "omnium-beslistabel",
    label: "Omnium: beslistabel",
    version: "1.0.0",
    help: "The decision table(s) of the page's DMN artefact, as a table: inputs, outputs and one row per rule. From a dmn-bron (Omnium JSON) or a generated DMN (XML).",
    configSchema: OmniumBeslistabelConfig,
  },
  {
    name: "omnium-tekening",
    label: "Omnium: tekening",
    version: "1.0.0",
    help: "The drawings (SVG from the render service) of the page's artefact: a drawing itself, or every drawing of a source (logical model, BPMN, DMN).",
    configSchema: OmniumTekeningConfig,
  },
] as const;
