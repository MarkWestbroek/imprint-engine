import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/account-forms";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Nieuw wachtwoord", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string }> };

/** Step two: the link from the mail carries the one-time token; the form sets the new password. */
export default async function ResetPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return (
    <article className="cg-page cg-narrow">
      <h1>Nieuw wachtwoord</h1>
      {token ? (
        <ResetForm action={resetPasswordAction} token={token} />
      ) : (
        <p className="cg-error">
          Deze pagina werkt alleen via de link uit de mail. <Link href="/account/forgot">Vraag een nieuwe link aan.</Link>
        </p>
      )}
    </article>
  );
}
