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
  leeg: z.string().default("Niets gevonden."),
});
export type OmniumLijstConfig = z.infer<typeof OmniumLijstConfig>;

export const OmniumDetailConfig = z.object({
  title: z.string().optional(),
  /** Gegevenselementen and relations to leave out, comma-separated json names (`artefact_inhouden`). */
  verberg: z.string().default(""),
});
export type OmniumDetailConfig = z.infer<typeof OmniumDetailConfig>;

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
    name: "omnium-tekening",
    label: "Omnium: tekening",
    version: "1.0.0",
    help: "The drawings (SVG from the render service) of the page's artefact: a drawing itself, or every drawing of a source (logical model, BPMN, DMN).",
    configSchema: OmniumTekeningConfig,
  },
] as const;
