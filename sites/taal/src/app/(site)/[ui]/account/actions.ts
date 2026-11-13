"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as members from "@imprint/runtime-admin/admin-server";
import type { MemberErrorCode } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { store } from "@/lib/content";
import { accountPad, accountTeksten, foutTekst, uiVan, type AccountTeksten } from "@/lib/account-teksten";

/** Same shape as the package's ActionResult (a re-export trips the "use server" scanner). */
export type ActionResult = { ok: boolean; error?: string; verifyUrl?: string };

type EngineResult = ActionResult & { code?: MemberErrorCode };

/**
 * The members' actions bound to this site, one per form. Each form says in
 * which interface language it was shown (`ui`): the links in the mails and
 * the sentences that come back are in that language.
 */
const zeg = (result: EngineResult, t: AccountTeksten): ActionResult =>
  result.ok ? { ok: true, verifyUrl: result.verifyUrl } : { ok: false, error: foutTekst(result, t) };

async function kader(ui: string) {
  const t = accountTeksten(ui);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || undefined;
  const site = await store.getSiteConfig();
  return { t, opts: { ip, baseUrl: site.baseUrl, accountPath: accountPad(ui), mail: t.mail } };
}

/** The repeat field of a new password (the form checks it too; this is for a post without JavaScript). */
const repeatDiffers = (formData: FormData) =>
  formData.has("confirm") && String(formData.get("password") ?? "") !== String(formData.get("confirm") ?? "");

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { t, opts } = await kader(uiVan(formData.get("ui")));
  if (repeatDiffers(formData)) return { ok: false, error: t.nietGelijk };
  const result = await members.registerMember(
    admin,
    {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      website: String(formData.get("website") ?? ""),
    },
    opts
  );
  return zeg(result, t);
}

export async function loginAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ui = uiVan(formData.get("ui"));
  // Redirects when it worked; what comes back is the failure.
  return zeg(await members.signInMember(admin, prev, formData, accountPad(ui)), accountTeksten(ui));
}

export async function logoutAction(formData: FormData): Promise<void> {
  return members.signOutMember(admin, `/${uiVan(formData.get("ui"))}`);
}

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { t, opts } = await kader(uiVan(formData.get("ui")));
  return zeg(await members.requestPasswordReset(admin, String(formData.get("email") ?? ""), opts), t);
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = accountTeksten(uiVan(formData.get("ui")));
  if (repeatDiffers(formData)) return { ok: false, error: t.nietGelijk };
  return zeg(await members.resetPasswordByToken(admin, String(formData.get("token") ?? ""), String(formData.get("password") ?? "")), t);
}

export async function resendVerificationAction(ui: string): Promise<ActionResult> {
  const { t, opts } = await kader(uiVan(ui));
  const session = await admin.auth.getSession();
  if (!session) return { ok: false, error: t.fout["not-signed-in"] };
  return zeg(await members.sendVerification(admin, session.name, opts.baseUrl, opts), t);
}

export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ui = uiVan(formData.get("ui"));
  const result = await members.deleteOwnAccount(admin, String(formData.get("password") ?? ""));
  // Gone: the account page has nobody to show, so on to signing in, which says so.
  if (result.ok) redirect(`${accountPad(ui, "login")}?deleted=1`);
  return zeg(result, accountTeksten(ui));
}
