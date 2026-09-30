import { RelationsScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

export default function AdminRelations() {
  return <RelationsScreen admin={admin} actions={adminActions} />;
}
