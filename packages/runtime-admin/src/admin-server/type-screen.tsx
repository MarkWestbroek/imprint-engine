import type { AdminContext } from "../admin-context";
import { pluginOf, type PluginCall } from "../plugin";
import type { AdminActions } from "./actions";
import { ListScreen } from "./list";
import { MediaLibraryScreen } from "./media-screen";
import { PluginScreen } from "./plugin-screen";
import { StatsScreen } from "./stats";

/**
 * `/admin/<segment>`: a plugin that claims the segment wins (the wiki plugin
 * owns `/admin/wiki`, even though `wiki` is also a listable type — its tree
 * studio is the right screen, not the flat list); the core's own screen for
 * its `asset` type (the media library); otherwise the generic list
 * of the content type; otherwise a 404. The site's `[type]/page.tsx` renders
 * this and nothing else (design/fase-5 §3.3).
 */
export async function AdminTypeScreen({
  admin,
  type,
  actions,
  call,
}: {
  admin: AdminContext;
  type: string;
  actions: Pick<AdminActions, "deleteItem" | "media">;
  call: PluginCall;
}) {
  if (pluginOf(admin, type)?.screen) {
    return <PluginScreen admin={admin} name={type} path={[]} call={call} />;
  }
  // The core's statistics (searches, visits): every site, through the same route.
  if (type === "stats" && !admin.imprint.contentTypes.has("stats")) {
    return <StatsScreen admin={admin} />;
  }
  if (type === "asset" && admin.imprint.contentTypes.has("asset", "listable")) {
    return <MediaLibraryScreen admin={admin} actions={actions.media} />;
  }
  return <ListScreen admin={admin} type={type} actions={actions} />;
}
