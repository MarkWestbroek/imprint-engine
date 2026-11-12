import { definePlugin, type ImprintPlugin, type PluginAction, type WidgetViewers } from "@imprint/runtime-admin";
import { taalActions } from "./actions";
import type { Stemmen } from "./audio";
import { taalContentTypes } from "./content-types";
import { taalPublicRoute } from "./public";
import { taalScreen } from "./screen";
import { azureTts, type Synthesize, type TtsConfig } from "./tts";
import { LesdialoogConfig, LesdialoogWidget, OefeningenConfig, OefeningenWidget } from "./widget";

/**
 * @imprint/plugin-taal — language training as a plugin
 * (design/taaltraining/README.md): the content type `les` (dialogue, chunks,
 * exercises), the widgets `lesdialoog` and `oefeningen`, the pages
 * `/<ui>/<pakket>/<les>`, and `/admin/taal` with the action that makes the
 * missing recordings through Azure text-to-speech. A site switches it on with
 * `plugins: [taalPlugin({ tts })]` and composes the widgets into its
 * catalogue (`taalWidgets` / `taalViewers`).
 *
 * Node scripts import the React-free entries: `./content-types`, `./schemas`,
 * `./href`, `./audio`, `./tts`, `./import`.
 */

export const taalWidgets = [
  {
    name: "lesdialoog",
    label: "Lesson dialogue",
    version: "1.0.0",
    help: "The dialogue of a lesson as a table: each sentence with play buttons (normal and slow) and its translation; below it the chunks.",
    configSchema: LesdialoogConfig,
  },
  {
    name: "oefeningen",
    label: "Lesson exercises",
    version: "1.0.0",
    help: "The exercises of a lesson, one at a time: listen, choose, type, order, say. The score stays in the visitor's browser.",
    configSchema: OefeningenConfig,
  },
] as const;

export const taalViewers: WidgetViewers = {
  lesdialoog: LesdialoogWidget as WidgetViewers[string],
  oefeningen: OefeningenWidget as WidgetViewers[string],
};

export type TaalOptions = {
  /** The interface languages of the site (the first segment of the address); default: nl and pl. */
  ui?: string[];
  /** The package `/<ui>` opens: the language taught; default nl. */
  pakket?: string;
  /** Azure text-to-speech; without a key the button says so and the browser's voice is used. */
  tts?: TtsConfig;
  /** Another speech service, or a fake in a test. */
  synthesize?: Synthesize;
  stemmen?: Stemmen;
};

export function taalPlugin(opts: TaalOptions = {}): ImprintPlugin {
  const actions = taalActions({ synthesize: opts.synthesize ?? azureTts(opts.tts), stemmen: opts.stemmen });
  return definePlugin({
    name: "taal",
    version: "0.15.0",
    contentTypes: taalContentTypes,
    widgets: [...taalWidgets],
    menu: [
      {
        group: "content",
        section: "Taal",
        items: [
          { href: "/admin/les", label: "Lessen" },
          { href: "/admin/taal", label: "Audio" },
        ],
      },
    ],
    screen: taalScreen(actions.audioStatus),
    actions: actions as unknown as Record<string, PluginAction>,
    publicRoute: taalPublicRoute(opts),
  });
}

export { taalActions, statusVan, type AudioOverzicht, type AudioResult, type AudioStatus } from "./actions";
export { taalContentTypes } from "./content-types";
export { lesHref, lesSlug, pakketHref, pakketNaam, pakketTaal, PAKKETTEN } from "./href";
export { TEKSTEN, UI_TALEN, teksten, type Teksten } from "./i18n";
export { Lesdialoog, LesOefeningen } from "./les-view";
export { getLes, listLessen, metVertaling, oefeningenVoor } from "./lessen";
export { taalPublicRoute, taalStaticPaths, type TaalRouteOptions } from "./public";
export { LesSchema, Oefening, type Les } from "./schemas";
export { LesdialoogConfig, OefeningenConfig } from "./widget";
