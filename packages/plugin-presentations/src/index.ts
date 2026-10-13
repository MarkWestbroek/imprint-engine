import { definePlugin, type ImprintPlugin, type WidgetViewers } from "@imprint/runtime-admin";
import { presentationsContentTypes } from "./content-types";
import { PresentationConfig, PresentationWidget } from "./widget";

/**
 * @imprint/plugin-presentations — slide decks as content: the type
 * `presentation` (slides as fixed 1920×1080 HTML canvases, the speaker notes
 * beside them, never in the HTML) and a widget that shows a deck scaled, with
 * previous/next, keys and fullscreen. Decks come in from the Slides format
 * with `importDeck` (./import, Node only). A site switches it on with
 * `plugins: [presentationsPlugin()]` and composes the widget into its
 * catalogue (`presentationWidgets` / `presentationViewers`).
 */

export const presentationWidgets = [
  {
    name: "presentation",
    label: "Presentation",
    version: "1.0.0",
    help: "A slide deck from Content → Presentations: scaled to the column, with previous/next, arrow keys and fullscreen. Speaker notes are never shown.",
    configSchema: PresentationConfig,
  },
] as const;

export const presentationViewers: WidgetViewers = { presentation: PresentationWidget as WidgetViewers[string] };

export function presentationsPlugin(): ImprintPlugin {
  return definePlugin({
    name: "presentations",
    version: "0.15.0",
    contentTypes: presentationsContentTypes,
    widgets: [...presentationWidgets],
    menu: [{ group: "content", section: "Presentations", items: [{ href: "/admin/presentation", label: "Presentations" }] }],
  });
}

export { PresentationSchema, SlideSchema, type Presentation, type Slide } from "./schemas";
