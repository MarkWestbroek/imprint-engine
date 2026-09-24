import { definePlugin, type ImprintPlugin, type WidgetViewers } from "@imprint/runtime-admin";
import { planningActions } from "./admin/actions";
import { planningScreen } from "./admin/screens";
import { planningContentTypes } from "./content-types";
import { PlanningConfig, PlanningWidget } from "./widget";

/**
 * @imprint/plugin-planning — planning boards as a plugin (design/fase-5):
 * two content types with their relation rules, the board admin under
 * `/admin/planning`, its actions, and the planning widget. A site switches
 * it on with `plugins: [planningPlugin()]` in imprint.config.ts; the widget's
 * React halves it composes itself (`planningWidgets`, `planningViewers`),
 * next to the standard widgets, because the catalogue is the site's.
 *
 * Node scripts (seed, tests) import the React-free entries instead:
 * `./content-types` and `./schemas`; this index pulls in screens and viewers.
 */

/** The widget's config schema, for the site's catalogue. */
export const planningWidgets = [
  {
    name: "planning",
    label: "Planning board",
    version: "1.0.0",
    help: "A live board backed by planning-items: phases as columns, cards with owner, rich text and component links. Edit it in the admin (drag & drop).",
    configSchema: PlanningConfig,
  },
] as const;

/** The widget's viewer, for the site's `widgetComponents`. */
export const planningViewers: WidgetViewers = { planning: PlanningWidget as WidgetViewers[string] };

export function planningPlugin(): ImprintPlugin {
  return definePlugin({
    name: "planning",
    version: "0.10.2",
    contentTypes: planningContentTypes,
    widgets: [...planningWidgets],
    menu: [{ group: "content", section: "Planning", items: [{ href: "/admin/planning", label: "Planning" }] }],
    screen: planningScreen,
    actions: planningActions,
  });
}

export { planningContentTypes } from "./content-types";
export { bucketInto, computeMove, groupIntoColumns, type PlanningColumn } from "./planning";
export { PlanningItemSchema, PlanningPhaseSchema, PlanningSchema, type Planning, type PlanningItem, type PlanningPhase } from "./schemas";
export { PlanningConfig, type PlanningConfig as PlanningWidgetConfig } from "./widget";
