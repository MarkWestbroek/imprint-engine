import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm, Vergeet } from "@/components/account-forms";
import { accountPad, accountTeksten, isUi } from "@/lib/account-teksten";
import { loginAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ ui: string }>; searchParams: Promise<{ next?: string; deleted?: string }> };

/** Sign in; `next` brings the learner back to where they were. */
export default async function LoginPage({ params, searchParams }: Props) {
  const { ui } = await params;
  if (!isUi(ui)) notFound();
  const t = accountTeksten(ui);
  const { next, deleted } = await searchParams;
  return (
    <article lang={ui} className="max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.inloggen}</h1>
      {deleted === "1" && (
        <p className="rounded-md border border-line bg-surface p-4">
          <Vergeet />
          {t.verwijderd}
        </p>
      )}
      <LoginForm ui={ui} action={loginAction} next={next && next.startsWith("/") ? next : accountPad(ui)} />
    </article>
  );
}
