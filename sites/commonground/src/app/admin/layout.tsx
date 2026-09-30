import { AdminGate } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

// Sessions live in a cookie, so everything under /admin renders per request.
export const dynamic = "force-dynamic";

/** The shared admin (@imprint/runtime-admin) with this site's context; see lib/admin.ts. */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminGate admin={admin} actions={adminActions} helpHref="https://imprint-engine.nl">
      {children}
    </AdminGate>
  );
}
