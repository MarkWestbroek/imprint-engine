"use client";

import { useActionState } from "react";
import type { RoleType } from "@imprint/content-core";
import type { UserRecord } from "@imprint/content-core/user-store";
import {
  changeOwnPasswordAction,
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  setRoleAction,
  type UserActionResult,
} from "@/app/admin/users/actions";

/**
 * Beheerscherm for the /admin users (UML: User + RoleType). Small on purpose:
 * a handful of accounts, no self-service signup, no e-mail. Resets hand out a
 * generated password that is shown once — the owner replaces it below.
 */

const INPUT =
  "mt-1 w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none";
const LABEL = "block text-xs font-medium uppercase tracking-wide text-muted";
const PRIMARY =
  "rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50";

function Feedback({ state }: { state: UserActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-sm text-emerald-400">{state.message ?? "Done ✓"}</p>
  ) : (
    <p className="text-sm text-red-400">{state.error}</p>
  );
}

export function UserTable({
  users,
  roles,
  currentUser,
}: {
  users: UserRecord[];
  roles: RoleType[];
  currentUser: string;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
          <th className="py-2 pr-4">User</th>
          <th className="py-2 pr-4">Role</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            roles={roles}
            isSelf={user.name === currentUser}
          />
        ))}
      </tbody>
    </table>
  );
}

function UserRow({
  user,
  roles,
  isSelf,
}: {
  user: UserRecord;
  roles: RoleType[];
  isSelf: boolean;
}) {
  const [roleState, roleAction, roleBusy] = useActionState(setRoleAction, null);
  const [resetState, resetAction, resetBusy] = useActionState(resetPasswordAction, null);
  const [deleteState, deleteAction, deleteBusy] = useActionState(deleteUserAction, null);
  const state = roleState ?? resetState ?? deleteState;

  return (
    <>
      <tr className="border-b border-line">
        <td className="py-2.5 pr-4 font-medium">
          {user.name}
          {isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
        </td>
        <td className="py-2.5 pr-4">
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="name" value={user.name} />
            <select
              name="role"
              defaultValue={user.role}
              disabled={roleBusy}
              className="rounded-md border border-line bg-background px-2 py-1 text-sm"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button className="rounded border border-line px-2 py-1 text-xs text-muted hover:border-accent">
              Set
            </button>
          </form>
        </td>
        <td className="py-2.5 text-right">
          <span className="flex justify-end gap-2">
            {!isSelf && (
              <form action={resetAction}>
                <input type="hidden" name="name" value={user.name} />
                <button
                  disabled={resetBusy}
                  className="rounded border border-line px-2 py-1 hover:border-accent disabled:opacity-50"
                >
                  Reset password
                </button>
              </form>
            )}
            {!isSelf && (
              <form action={deleteAction}>
                <input type="hidden" name="name" value={user.name} />
                <button
                  disabled={deleteBusy}
                  className="rounded border border-line px-2 py-1 text-muted hover:border-red-400 hover:text-red-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </form>
            )}
          </span>
        </td>
      </tr>
      {state && (
        <tr>
          <td colSpan={3} className="pb-2.5">
            {/* Generated passwords land here: selectable, and gone on reload. */}
            <span className="break-all font-mono text-xs">
              <Feedback state={state} />
            </span>
          </td>
        </tr>
      )}
    </>
  );
}

export function NewUserForm({ roles }: { roles: RoleType[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, null);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Add user</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={LABEL}>username</span>
          <input name="name" autoComplete="off" className={`${INPUT} w-48`} />
        </label>
        <label className="block">
          <span className={LABEL}>role</span>
          <select name="role" defaultValue="editor" className={`${INPUT} w-32`}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>password (optional)</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="leave empty to generate"
            className={`${INPUT} w-56`}
          />
        </label>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
      <span className="break-all font-mono text-xs">
        <Feedback state={state} />
      </span>
    </form>
  );
}

export function OwnPasswordForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, null);

  return (
    <form
      action={formAction}
      className="max-w-sm space-y-3 rounded-xl border border-line bg-surface p-5"
    >
      <h2 className="text-sm font-semibold">Change my password</h2>
      {/* Lets a password manager offer to update the right entry. */}
      <input type="hidden" name="username" autoComplete="username" value={name} readOnly />
      <label className="block">
        <span className={LABEL}>current password</span>
        <input name="current" type="password" autoComplete="current-password" className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>new password</span>
        <input name="next" type="password" autoComplete="new-password" className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>repeat new password</span>
        <input name="confirm" type="password" autoComplete="new-password" className={INPUT} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Change password"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
