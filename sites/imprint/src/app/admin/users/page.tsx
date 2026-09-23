import { UsersScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

export default function AdminUsers() {
  return <UsersScreen admin={admin} actions={adminActions} />;
}
