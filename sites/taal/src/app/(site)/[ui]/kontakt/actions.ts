"use server";

import { headers } from "next/headers";
import { sendContactMessage } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { accountTeksten, uiVan } from "@/lib/account-teksten";

export type ContactState = { ok: boolean; error?: string } | null;

/** The contact form, bound to this site: the owner's address comes from CONTACT_TO, never from the page. */
export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const ui = uiVan(formData.get("ui"));
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || undefined;
  const result = await sendContactMessage(
    admin,
    {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      message: String(formData.get("message") ?? ""),
      website: String(formData.get("website") ?? ""),
      page: `/${ui}/kontakt`,
    },
    { to: process.env.CONTACT_TO, ip }
  );
  return result.ok ? { ok: true } : { ok: false, error: accountTeksten(ui).kontakt.fout[result.code ?? "failed"] };
}
