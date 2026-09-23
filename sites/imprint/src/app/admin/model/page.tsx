import { ModelScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

export default function ContentModelPage() {
  return <ModelScreen admin={admin} />;
}
