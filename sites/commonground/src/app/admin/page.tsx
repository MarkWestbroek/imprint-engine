import { DashboardScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

export default function AdminDashboard() {
  return <DashboardScreen admin={admin} />;
}
