import { definePlugin, type ImprintPlugin, type WidgetViewers } from "@imprint/runtime-admin";
import { glossaryContentTypes } from "./content-types";
import { glossaryPublicRoute } from "./public";
import { GlossaryConfig, GlossaryWidget } from "./widget";

/**
 * @imprint/plugin-glossary — a glossary as a plugin (design/communities.md
 * §4.7): the content type `term`, a searchable card overview as widget, and a
 * page per term under `/term/<slug>`. A site switches it on with
 * `plugins: [glossaryPlugin()]` and composes the widget into its catalogue
 * (`glossaryWidgets` / `glossaryViewers`), as with the planning plugin.
 * Recognising terms in running text is the next step (backlog).
 *
 * Node scripts import the React-free entries: `./content-types`, `./schemas`, `./href`.
 */

/** The widget's config schema, for the site's catalogue. */
export const glossaryWidgets = [
  {
    name: "glossary",
    label: "Glossary",
    version: "1.0.0",
    help: "The terms as cards with a search field; optionally only the terms with one tag (e.g. afkorting).",
    configSchema: GlossaryConfig,
  },
] as const;

/** The widget's viewer, for the site's `widgetComponents`. */
export const glossaryViewers: WidgetViewers = { glossary: GlossaryWidget as WidgetViewers[string] };

export function glossaryPlugin(opts: { indexHref?: string } = {}): ImprintPlugin {
  return definePlugin({
    name: "glossary",
    version: "0.11.0",
    contentTypes: glossaryContentTypes,
    widgets: [...glossaryWidgets],
    menu: [{ group: "content", section: "Glossary", items: [{ href: "/admin/term", label: "Terms" }] }],
    publicRoute: glossaryPublicRoute(opts.indexHref),
  });
}

export { glossaryContentTypes } from "./content-types";
export { TERM_PREFIX, termHref, termSlug, termSummary } from "./href";
export { TermSchema, type Term } from "./schemas";
export { GlossaryConfig, type GlossaryConfig as GlossaryWidgetConfig } from "./widget";
export { getTerm, listTerms } from "./glossary";
