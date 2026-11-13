import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RegisterForm } from "@/components/account-forms";
import { accountPad, accountTeksten, isUi } from "@/lib/account-teksten";
import { registerAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ ui: string }> };

/** An account is optional: it only carries results and the choice of forms to another device. */
export default async function RegisterPage({ params }: Props) {
  const { ui } = await params;
  if (!isUi(ui)) notFound();
  const t = accountTeksten(ui);
  return (
    <article lang={ui} className="max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.registreren}</h1>
      <p className="text-muted">
        {t.waarom}{" "}
        <Link href={accountPad(ui, "privacy")} className="underline underline-offset-4">
          {t.privacy}
        </Link>
      </p>
      <RegisterForm ui={ui} action={registerAction} />
    </article>
  );
}
