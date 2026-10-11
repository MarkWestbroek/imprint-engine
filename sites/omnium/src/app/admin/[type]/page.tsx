import { AdminTypeScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";
import { pluginAction } from "../actions";

type Props = { params: Promise<{ type: string }> };

/** `/admin/<type>`: a plugin's own screen, else the generic list of a content type (design/fase-5 §3.3). */
export default async function AdminType({ params }: Props) {
  const { type } = await params;
  return <AdminTypeScreen admin={admin} type={type} actions={adminActions} call={pluginAction} />;
}
