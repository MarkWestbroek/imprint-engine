import { ListScreen, PluginScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";
import { pluginAction } from "./../actions";

type Props = { params: Promise<{ type: string }> };

/** `/admin/<type>`: the generic list of a content type — or a plugin's own screen (design/fase-5 §3.3). */
export default async function AdminList({ params }: Props) {
  const { type } = await params;
  if (admin.imprint.contentTypes.has(type, "listable")) {
    return <ListScreen admin={admin} type={type} actions={adminActions} />;
  }
  return <PluginScreen admin={admin} name={type} path={[]} call={pluginAction} />;
}
