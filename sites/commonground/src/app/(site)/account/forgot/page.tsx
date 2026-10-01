import type { Metadata } from "next";
import { ForgotForm } from "@/components/account-forms";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Wachtwoord vergeten", robots: { index: false } };

/** Step one of "wachtwoord vergeten": ask for the address; the answer never reveals whether it is known. */
export default function ForgotPage() {
  return (
    <article className="cg-page cg-narrow">
      <h1>Wachtwoord vergeten</h1>
      <p>Vul het e-mailadres van je account in. Je krijgt een mail met een link om een nieuw wachtwoord te kiezen.</p>
      <ForgotForm action={forgotPasswordAction} />
    </article>
  );
}
