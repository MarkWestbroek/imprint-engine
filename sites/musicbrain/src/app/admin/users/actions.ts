"use server";

import * as users from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** Same shape as the package's UserActionResult (a re-export trips the "use server" scanner). */
export type UserActionResult = { ok: boolean; error?: string; message?: string };

// One-line wrappers around the shared admin's user actions; see app/admin/actions.ts.
export async function createUserAction(prev: UserActionResult | null, formData: FormData): Promise<UserActionResult> {
  return users.createUser(admin, prev, formData);
}

export async function resetPasswordAction(prev: UserActionResult | null, formData: FormData): Promise<UserActionResult> {
  return users.resetPassword(admin, prev, formData);
}

export async function setRoleAction(prev: UserActionResult | null, formData: FormData): Promise<UserActionResult> {
  return users.setRole(admin, prev, formData);
}

export async function deleteUserAction(prev: UserActionResult | null, formData: FormData): Promise<UserActionResult> {
  return users.deleteUser(admin, prev, formData);
}

export async function changeOwnPasswordAction(prev: UserActionResult | null, formData: FormData): Promise<UserActionResult> {
  return users.changeOwnPassword(admin, prev, formData);
}
