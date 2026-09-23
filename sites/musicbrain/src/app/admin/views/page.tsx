import { ViewsScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

export default function AdminViews() {
  return <ViewsScreen admin={admin} />;
}
