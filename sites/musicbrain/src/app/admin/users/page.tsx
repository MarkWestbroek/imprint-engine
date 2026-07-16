import { RoleType } from "@imprint/content-core";
import { canEdit, getSession, userStore } from "@/lib/auth";
import {
  NewUserForm,
  OwnPasswordForm,
  UserTable,
} from "@/components/admin/user-manager";

/**
 * Everyone signed in can change their own password here; only admins see the
 * user list. Locked out entirely? `npm run user -- passwd <name>` on the
 * server is the way back in (README, "Wachtwoord kwijt").
 */
export default async function AdminUsers() {
  const session = await getSession();
  if (!canEdit(session)) return null; // the layout renders the login form
  const isAdmin = session.role === "admin";
  const users = isAdmin && userStore ? await userStore.list() : [];
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
            <UserTable users={users} roles={roles} currentUser={session.name} />
          </div>
          <div className="mt-6">
            <NewUserForm roles={roles} />
          </div>
        </>
      )}

      <div className="mt-6">
        <OwnPasswordForm name={session.name} />
      </div>

      <p className="mt-4 text-xs text-muted">
        Signing out doesn&apos;t reach other browsers: a session cookie stays
        valid for up to 12 hours after a reset, role change or delete.
      </p>
    </div>
  );
}
