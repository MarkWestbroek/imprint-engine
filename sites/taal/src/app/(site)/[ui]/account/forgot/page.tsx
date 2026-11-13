import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForgotForm } from "@/components/account-forms";
import { accountTeksten, isUi } from "@/lib/account-teksten";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ ui: string }> };

/** Step one of a new password: the address; the mail carries a one-time link. */
export default async function ForgotPage({ params }: Props) {
  const { ui } = await params;
  if (!isUi(ui)) notFound();
  const t = accountTeksten(ui);
  return (
    <article lang={ui} className="max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.wachtwoordVergeten}</h1>
      <ForgotForm ui={ui} action={forgotPasswordAction} />
    </article>
  );
}
