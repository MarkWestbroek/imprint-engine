import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { memberProfile } from "@imprint/runtime-admin/admin-server";
import { Leerling, pakketHref } from "@imprint/plugin-taal";
import { DeleteForm, LogoutButton, ResendButton } from "@/components/account-forms";
import { pluginAction } from "@/app/admin/actions";
import { admin } from "@/lib/admin";
import { imprint } from "@/lib/content";
import { accountPad, accountTeksten } from "@/lib/account-teksten";
import { TAAL } from "../../../../../imprint.config";
import { deleteAccountAction, logoutAction, resendVerificationAction } from "./actions";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ui: string }>; searchParams: Promise<{ verified?: string }> };

/** The learner's own page: who they are, whether the address is verified, how far they are; signing out and leaving. */
export default async function AccountPage({ params, searchParams }: Props) {
  const { ui } = await params;
  if (!TAAL.ui.includes(ui)) notFound();
  const profile = await memberProfile(admin);
  if (!profile) redirect(`${accountPad(ui, "login")}?next=${accountPad(ui)}`);
  const t = accountTeksten(ui);
  const { verified } = await searchParams;
  const { user, canEdit } = profile;
  const waarden = imprint.users ? await imprint.users.memberValues(user.name, "taal") : {};
  const gedaan = Object.keys(waarden).filter((k) => k.startsWith("les:")).length;
  return (
    <article lang={ui} className="max-w-xl space-y-6">
      {/* Right after signing in: bring what this browser kept and the account in line. */}
      <Leerling call={pluginAction} />
      <h1 className="text-3xl font-semibold tracking-tight">{t.account}</h1>
      {verified === "1" && <p className="rounded-md border border-line bg-surface p-4">{t.bevestigd}</p>}
      {verified === "0" && <p className="font-semibold">{t.nietBevestigdLink}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-muted">{t.naam}</dt>
        <dd>{user.name}</dd>
        <dt className="text-muted">{t.email}</dt>
        <dd>
          {user.email ?? <span className="text-muted">{t.geen}</span>}
          {user.email && !user.emailVerified && (
            <>
              {" "}
              <span className="whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t.nogNietBevestigd}</span>{" "}
              <ResendButton ui={ui} action={resendVerificationAction} />
            </>
          )}
        </dd>
      </dl>
      <p>{t.lessenGedaan.replace("{n}", String(gedaan))}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Link href={pakketHref(ui, TAAL.pakket)} className="rounded-md bg-accent px-4 py-2 font-semibold text-background hover:bg-accent-strong">
          {t.naarLessen}
        </Link>
        <LogoutButton ui={ui} action={logoutAction} />
        {canEdit && (
          <Link href="/admin" className="underline underline-offset-4">
            {t.naarAdmin}
          </Link>
        )}
      </div>
      <p>
        <Link href={accountPad(ui, "privacy")} className="underline underline-offset-4">
          {t.privacy}
        </Link>
      </p>
      {!canEdit && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-3 text-xl font-semibold">{t.verwijderen}</h2>
          <DeleteForm ui={ui} action={deleteAccountAction} />
        </section>
      )}
    </article>
  );
}
