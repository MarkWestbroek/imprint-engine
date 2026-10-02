import { definePlugin, type ImprintPlugin, type PluginAction, type WidgetViewers } from "@imprint/runtime-admin";
import { groupsActions } from "./actions";
import { groupsContentTypes } from "./content-types";
import { groupsPublicRoute } from "./public";
import { GroupsConfig, GroupsWidget } from "./widget";

/**
 * @imprint/plugin-groups — groups (communities) as a plugin, step G0 of
 * design/communities.md: the content type `group`, a card overview as widget,
 * `/groups` and a page per group under `/groups/<slug>`, with the group's
 * wiki (a Wiki of its own) and pages (`groups/<slug>/…`) linked from it.
 * G1: joining (open or on request), the manager's page
 * (`GroupManageScreen`, mounted by the site at `/groups/<slug>/manage`) and
 * invitation links (`/groups/<slug>/join/<code>`, redeemed by the site);
 * the actions run through the site's plugin dispatcher. G2: `access:
 * group:<slug>` on content. G3a: members write updates and blogs in their
 * group from its page (`writePost`/`removePost`, the PDP decides). A site switches it
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
    actions: groupsActions as unknown as Record<string, PluginAction>,
    publicRoute: groupsPublicRoute,
  });
}

export { groupsContentTypes } from "./content-types";
export { GROUPS_PREFIX, groupHref, groupPagePrefix, groupSlug, groupsHref } from "./href";
export { GroupSchema, type Group } from "./schemas";
export { GroupsConfig, type GroupsConfig as GroupsWidgetConfig } from "./widget";
export { getGroup, listGroups } from "./groups";
export { groupsActions, redeem as redeemInvite, type JoinStatus, type MemberList, type PostInput, type PostRights } from "./actions";
export { PostTools } from "./post-tools";
export { GroupManageScreen } from "./manage";
