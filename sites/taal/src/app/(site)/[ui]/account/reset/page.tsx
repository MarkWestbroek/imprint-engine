import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ResetForm } from "@/components/account-forms";
import { accountPad, accountTeksten, isUi } from "@/lib/account-teksten";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ ui: string }>; searchParams: Promise<{ token?: string }> };

/** Step two: the link from the mail carries the one-time token; the form sets the new password. */
export default async function ResetPage({ params, searchParams }: Props) {
  const { ui } = await params;
  if (!isUi(ui)) notFound();
  const t = accountTeksten(ui);
  const { token } = await searchParams;
  return (
    <article lang={ui} className="max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.nieuwWachtwoord}</h1>
      {token ? (
        <ResetForm ui={ui} action={resetPasswordAction} token={token} />
      ) : (
        <p>
          {t.alleenViaLink}{" "}
          <Link href={accountPad(ui, "forgot")} className="underline underline-offset-4">
            {t.nieuweLink}
          </Link>
        </p>
      )}
    </article>
  );
}
