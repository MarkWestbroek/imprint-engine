import { PluginScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { pluginAction } from "../../actions";

type Props = { params: Promise<{ type: string; path: string[] }> };

/** `/admin/<plugin>/<path>`: a plugin's deeper screens (`edit` and `history` are the content types' own routes). */
export default async function PluginPage({ params }: Props) {
  const { type, path } = await params;
  return <PluginScreen admin={admin} name={type} path={path} call={pluginAction} />;
}
