"use server";

import { revalidatePath } from "next/cache";
import { RoleType } from "@imprint/content-core";
import { generatePassword } from "@imprint/content-core/passwords";
import { canEdit, getSession, userStore, type Session } from "@/lib/auth";

/**
 * User administration (UML: User + RoleType). A Server Action is a public POST
 * endpoint, so rendering the form only for admins proves nothing — every
 * action re-checks the session itself, and the role comes from that session,
 * never from the form.
 */

export type UserActionResult = { ok: boolean; error?: string; message?: string };

/** Signed in and holding the admin role — the gate for managing *other* users. */
async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!canEdit(session)) throw new Error("Not signed in");
  if (session.role !== "admin") throw new Error("Only admins can manage users");
  if (!userStore) throw new Error("User management requires DATABASE_URL");
  return session;
}

function failure(err: unknown): UserActionResult {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

export async function createUserAction(
  _prev: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const role = RoleType.parse(String(formData.get("role") ?? "editor"));
    const given = String(formData.get("password") ?? "");
    const password = given || generatePassword();

    await userStore!.create(name, password, role);
    revalidatePath("/admin/users");
    return {
      ok: true,
      message: given
        ? `Added ${name} (${role}).`
        : `Added ${name} (${role}). Password: ${password}`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function resetPasswordAction(
  _prev: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "");
    const password = generatePassword();
    await userStore!.setPassword(name, password);
    return {
      ok: true,
      message: `New password for ${name}: ${password} — shown once, copy it now.`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function setRoleAction(
  _prev: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  try {
    const session = await requireAdmin();
    const name = String(formData.get("name") ?? "");
    const role = RoleType.parse(String(formData.get("role") ?? ""));
    // The last-admin guard lives in the store, but demoting *yourself* while
    // another admin exists is legal there and still locks you out of this page.
    if (name === session.name && role !== "admin") {
      throw new Error("You can't take the admin role away from yourself");
    }
    await userStore!.setRole(name, role);
    revalidatePath("/admin/users");
    return { ok: true, message: `${name} is now ${role}.` };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteUserAction(
  _prev: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  try {
    const session = await requireAdmin();
    const name = String(formData.get("name") ?? "");
    if (name === session.name) throw new Error("You can't delete your own account");
    await userStore!.remove(name);
    revalidatePath("/admin/users");
    return { ok: true, message: `Deleted ${name}.` };
  } catch (err) {
    return failure(err);
  }
}

/** Own password: no admin role needed, but the current password must check out. */
export async function changeOwnPasswordAction(
  _prev: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  try {
    const session = await getSession();
    if (!canEdit(session)) throw new Error("Not signed in");
    if (!userStore) throw new Error("User management requires DATABASE_URL");

    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    if (next !== String(formData.get("confirm") ?? "")) {
      throw new Error("The two new passwords don't match");
    }
    // session.name, not a form field: this can only ever change your own password.
    await userStore.changePassword(session.name, current, next);
    return { ok: true, message: "Password changed." };
  } catch (err) {
    return failure(err);
  }
}
