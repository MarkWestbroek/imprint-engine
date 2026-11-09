import { definePlugin, type ImprintPlugin } from "@imprint/runtime-admin";
import { omniumWidgets } from "./schemas";

/**
 * @imprint/plugin-omnium — the Omnium register (inrichting van e-diensten),
 * read-only (design/omnium-inrichting.md). The register stays the source:
 * Imprint keeps no copy, only the pages and templates that show it.
 *
 *  - `./client`: `OmniumRegister` on `/full` with time travel; the site
 *    configures it with OMNIUM_REGISTER_URL and OMNIUM_REGISTER_TOKEN.
 *  - `./inrichting`: the types and their stable keys (URLs without ids).
 *  - widgets `omnium-lijst` and `omnium-detail` for the studio templates
 *    `_view/omnium-<pad>`; the site composes them (`omniumWidgets` in its
 *    registry, `omniumViewers` in its components).
 *  - `./page`: `omniumPage()` for the site's `/inrichting/[...path]` route.
 */
export function omniumPlugin(): ImprintPlugin {
  return definePlugin({
    name: "omnium",
    version: "0.15.0",
    widgets: [...omniumWidgets],
  });
}

export { omniumWidgets, OmniumBeslistabelConfig, OmniumDetailConfig, OmniumFormulierConfig, OmniumLijstConfig, OmniumTekeningConfig } from "./schemas";
export { omniumViewers, OmniumBeslistabel, OmniumDetail, OmniumFormulier, OmniumLijst, OmniumTekening } from "./widgets";
export { omniumPage, omniumViewType } from "./page";
export { OmniumRegister, OmniumRegisterError, registerConfigFromEnv, registerProblem, type ReadMoment } from "./client";
export { Inrichting, AmbiguousKey, INRICHTING_TYPES, PADS, type Pad, type Located } from "./inrichting";
export { isOmniumSubject, type OmniumSubject } from "./context";
export { fromBron, fromXml, BeslistabelView, type Beslistabel } from "./beslistabel";
export { fromFormio, fromNeutraal, visible, type NeutralForm, type Question, type QuestionType } from "./neutral-form";
export { werkplaatsData, STAPPEN, isStap, type Stap, type WerkplaatsData } from "./werkplaats";
