import type { AdminContext } from "../admin-context";
import { pluginOf, type PluginCall } from "../plugin";
import type { AdminActions } from "./actions";
import { ListScreen } from "./list";
import { PluginScreen } from "./plugin-screen";

/**
 * `/admin/<segment>`: a plugin that claims the segment wins (the wiki plugin
 * owns `/admin/wiki`, even though `wiki` is also a listable type — its tree
 * studio is the right screen, not the flat list); otherwise the generic list
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
  actions: Pick<AdminActions, "deleteItem">;
  call: PluginCall;
}) {
  if (pluginOf(admin, type)?.screen) {
    return <PluginScreen admin={admin} name={type} path={[]} call={call} />;
  }
  return <ListScreen admin={admin} type={type} actions={actions} />;
}
