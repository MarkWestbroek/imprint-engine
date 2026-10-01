"use server";

import { headers } from "next/headers";
import * as members from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { store } from "@/lib/content";

/** Same shape as the package's ActionResult (a re-export trips the "use server" scanner). */
export type ActionResult = { ok: boolean; error?: string; verifyUrl?: string };

/** The members' actions (design/communities.md §4.1) bound to this site: one line each, as with the admin. */
export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || undefined;
  const site = await store.getSiteConfig();
  return members.registerMember(
    admin,
    {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      website: String(formData.get("website") ?? ""),
    },
    { ip, baseUrl: site.baseUrl }
  );
}

export async function loginAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return members.signInMember(admin, prev, formData);
}

export async function logoutAction(): Promise<void> {
  return members.signOutMember(admin, "/");
}

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || undefined;
  const site = await store.getSiteConfig();
  return members.requestPasswordReset(admin, String(formData.get("email") ?? ""), { ip, baseUrl: site.baseUrl });
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return members.resetPasswordByToken(admin, String(formData.get("token") ?? ""), String(formData.get("password") ?? ""));
}

export async function resendVerificationAction(): Promise<ActionResult> {
  const session = await admin.auth.getSession();
  if (!session) return { ok: false, error: "Log eerst in." };
  const site = await store.getSiteConfig();
  return members.sendVerification(admin, session.name, site.baseUrl);
}
