import type { Metadata } from "next";
import { RegisterForm } from "@/components/account-forms";
import { registerAction } from "../actions";

export const metadata: Metadata = { title: "Registreren", robots: { index: false } };

/** Self-registration (design/communities.md §4.1): a member with a verified e-mail address may join communities. */
export default function RegisterPage() {
  return (
    <article className="cg-page cg-narrow">
      <h1>Account maken</h1>
      <p>
        Met een account kun je lid worden van communities. Je e-mailadres gebruiken we alleen om je account te bevestigen en
        voor berichten uit je communities.
      </p>
      <RegisterForm action={registerAction} />
    </article>
  );
}
