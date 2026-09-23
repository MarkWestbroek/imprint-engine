import type { ReactNode } from "react";
import { AdminShell } from "../admin/admin-shell";
import { LoginForm } from "../admin/login-form";
import type { AdminContext } from "../admin-context";
import type { AdminActions } from "./actions";
import { adminMenu } from "./menu";

/**
 * What the site's app/admin/layout.tsx renders: the "no database" notice,
 * the login form, or the shell with the menu around the screens. The route
 * file itself only sets `dynamic = "force-dynamic"` and passes the context.
 */
export async function AdminGate({
  admin,
  actions,
  helpHref,
  children,
}: {
  admin: AdminContext;
  actions: Pick<AdminActions, "login" | "logout">;
  helpHref?: string;
  children: ReactNode;
}) {
  if (!admin.imprint.writableStore) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-sm text-muted">
        <h1 className="mb-2 text-lg font-semibold text-foreground">Admin unavailable</h1>
        <p>
          The admin needs a database: set <code>DATABASE_URL</code> in{" "}
          <code>.env.local</code> (see <code>.env.example</code>), run the
          migrations and seed, and restart. Without it the site serves the
          file-backed content from git (v0 mode).
        </p>
      </main>
    );
  }

  const session = await admin.auth.editingSession();
  if (!session) {
    return (
      <main className="flex-1 px-4">
        <LoginForm action={actions.login} />
      </main>
    );
  }

  return (
    <AdminShell session={session} groups={adminMenu(admin)} logout={actions.logout} helpHref={helpHref}>
      {children}
    </AdminShell>
  );
}
