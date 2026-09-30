import { definePlugin, type ImprintPlugin, type WidgetViewers } from "@imprint/runtime-admin";
import { groupsContentTypes } from "./content-types";
import { groupsPublicRoute } from "./public";
import { GroupsConfig, GroupsWidget } from "./widget";

/**
 * @imprint/plugin-groups — groups (communities) as a plugin, step G0 of
 * design/communities.md: the content type `group`, a card overview as widget,
 * `/groups` and a page per group under `/groups/<slug>`, with the group's
 * wiki (a Wiki of its own) and pages (`groups/<slug>/…`) linked from it.
 * Members, joining and group-only content follow (G1–G3). A site switches it
 * on with `plugins: [groupsPlugin()]` and composes the widget into its
 * catalogue (`groupsWidgets` / `groupsViewers`).
 *
 * Node scripts import the React-free entries: `./content-types`, `./schemas`, `./href`.
 */

/** The widget's config schema, for the site's catalogue. */
export const groupsWidgets = [
  {
    name: "groups",
    label: "Groups",
    version: "1.0.0",
    help: "The groups (communities) as cards with a search field; optionally only the groups with one tag.",
    configSchema: GroupsConfig,
  },
] as const;

/** The widget's viewer, for the site's `widgetComponents`. */
export const groupsViewers: WidgetViewers = { groups: GroupsWidget as WidgetViewers[string] };

export function groupsPlugin(): ImprintPlugin {
  return definePlugin({
    name: "groups",
    version: "0.11.0",
    contentTypes: groupsContentTypes,
    widgets: [...groupsWidgets],
    menu: [{ group: "content", section: "Groups", items: [{ href: "/admin/group", label: "Groups" }] }],
    publicRoute: groupsPublicRoute,
  });
}

export { groupsContentTypes } from "./content-types";
export { GROUPS_PREFIX, groupHref, groupPagePrefix, groupSlug, groupsHref } from "./href";
export { GroupSchema, type Group } from "./schemas";
export { GroupsConfig, type GroupsConfig as GroupsWidgetConfig } from "./widget";
export { getGroup, listGroups } from "./groups";
