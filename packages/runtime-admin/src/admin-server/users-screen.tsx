import { RoleType } from "@imprint/content-core";
import { NewUserForm, OwnPasswordForm, UserTable } from "../admin/user-manager";
import type { AdminContext } from "../admin-context";
import type { AdminActions } from "./actions";

/**
 * Everyone signed in can change their own password here; only admins see the
 * user list. Locked out entirely? `npm run user -- passwd <name>` on the
 * server is the way back in (README, "Wachtwoord kwijt").
 */
export async function UsersScreen({
  admin,
  actions,
}: {
  admin: AdminContext;
  actions: Pick<AdminActions, "users" | "changeOwnPassword">;
}) {
  const session = await admin.auth.editingSession();
  if (!session) return null; // the gate renders the login form
  const isAdmin = session.role === "admin";
  const users = isAdmin && admin.imprint.users ? await admin.imprint.users.list() : [];
  const roles = [...RoleType.options];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-muted">
        {isAdmin
          ? "Accounts for /admin. Admins manage users, editors edit content, readers can do neither. A reset hands out a generated password once — the owner replaces it below."
          : "Your account. Ask an admin to change your role or reset your password."}
      </p>

      {isAdmin && (
        <>
          <div className="mt-6">
            <UserTable users={users} roles={roles} currentUser={session.name} actions={actions.users} />
          </div>
          <div className="mt-6">
            <NewUserForm roles={roles} actions={actions.users} />
          </div>
        </>
      )}

      <div className="mt-6">
        <OwnPasswordForm name={session.name} action={actions.changeOwnPassword} />
      </div>

      <p className="mt-4 text-xs text-muted">
        Signing out doesn&apos;t reach other browsers: a session cookie stays
        valid for up to {admin.imprint.session.hours} hours after a reset, role change or delete.
      </p>
    </div>
  );
}
