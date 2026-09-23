import { ListScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

type Props = { params: Promise<{ type: string }> };

export default async function AdminList({ params }: Props) {
  const { type } = await params;
  return <ListScreen admin={admin} type={type} actions={adminActions} />;
}
