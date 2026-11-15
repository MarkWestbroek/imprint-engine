"use server";

import { headers } from "next/headers";
import { sendContactMessage } from "@imprint/runtime-admin/admin-server";
import type { ContactState } from "@/components/contact-form";
import { CONTACT_TEKSTEN, contactTaal } from "@/lib/contact-teksten";

/** The contact form (widget `contact`), bound to this site: the owner's address comes from CONTACT_TO, never from the page. */
export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Loaded here, not at the top: lib/admin imports the widget viewers, and the contact viewer imports this action.
  const { admin } = await import("@/lib/admin");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || undefined;
  const result = await sendContactMessage(
    admin,
    {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      message: String(formData.get("message") ?? ""),
      website: String(formData.get("website") ?? ""),
      page: String(formData.get("page") ?? "").slice(0, 200),
    },
    { to: process.env.CONTACT_TO, ip }
  );
  const fout = CONTACT_TEKSTEN[contactTaal(formData.get("taal"))].fout;
  return result.ok ? { ok: true } : { ok: false, error: fout[result.code ?? "failed"] };
}
