import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { memberProfile } from "@imprint/runtime-admin/admin-server";
import { groupHref } from "@imprint/plugin-groups/href";
import { eventHref } from "@imprint/plugin-events/href";
import { imprint } from "@/lib/content";
import { ResendButton } from "@/components/account-forms";
import { admin } from "@/lib/admin";
import { logoutAction, resendVerificationAction } from "./actions";

export const metadata: Metadata = { title: "Mijn account", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ verified?: string }> };

const ROLE: Record<string, string> = { owner: "eigenaar", manager: "beheerder", member: "lid" };

/** The member's own page: who they are, whether the address is verified, their communities. */
export default async function AccountPage({ searchParams }: Props) {
  const profile = await memberProfile(admin);
  if (!profile) redirect("/account/login?next=/account");
  const { verified } = await searchParams;
  const { user, memberships, canEdit } = profile;
  // The member's sign-ups, with the events' titles (as far as they still exist).
  const signups = imprint.users ? await imprint.users.attendancesOf(user.name) : [];
  const events = await Promise.all(
    signups.map(async (a) => ({ ...a, title: ((await imprint.writableStore?.getItem("event", a.eventSlug))?.data as { title?: string } | undefined)?.title }))
  );
  const ANSWER: Record<string, string> = { attending: "ik kom", maybe: "misschien", not: "ik kom niet" };
  return (
    <article className="cg-page cg-narrow">
      <h1>Mijn account</h1>
      {verified === "1" && <p className="cg-notice">Je e-mailadres is bevestigd. Welkom!</p>}
      {verified === "0" && <p className="cg-error">Deze bevestigingslink is onbekend, al gebruikt of verlopen.</p>}
      <dl className="cg-dl">
        <dt>Naam</dt>
        <dd>{user.name}</dd>
        <dt>E-mailadres</dt>
        <dd>
          {user.email ?? <span className="cg-muted">geen</span>}
          {user.email && !user.emailVerified && (
            <>
              {" "}
              <span className="cg-badge">nog niet bevestigd</span> <ResendButton action={resendVerificationAction} />
            </>
          )}
        </dd>
        <dt>Rol</dt>
        <dd>{canEdit ? user.role : "lid"}</dd>
      </dl>

      <h2>Mijn communities</h2>
      {memberships.length === 0 ? (
        <p className="cg-muted">
          Je bent nog nergens lid van. <Link href="/groups">Bekijk de communities.</Link>
        </p>
      ) : (
        <ul className="cg-results">
          {memberships.map((m) => (
            <li key={m.groupSlug}>
              <Link href={groupHref(m.groupSlug)}>{m.groupSlug}</Link>
              <p>
                {m.status === "active" ? ROLE[m.role] : "aanvraag ingediend"}
                {m.status === "active" && m.role !== "member" && (
                  <>
                    {" · "}
                    <Link href={`${groupHref(m.groupSlug)}/manage`}>beheer</Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2>Mijn evenementen</h2>
      {events.length === 0 ? (
        <p className="cg-muted">
          Nog geen aanmeldingen. <Link href="/events">Bekijk de agenda.</Link>
        </p>
      ) : (
        <ul className="cg-results">
          {events.map((e) => (
            <li key={e.eventSlug}>
              <Link href={eventHref(e.eventSlug)}>{e.title ?? e.eventSlug}</Link>
              <p>{ANSWER[e.status] ?? e.status}</p>
            </li>
          ))}
        </ul>
      )}

      <form action={logoutAction} className="cg-form cg-form-inline">
        {canEdit && (
          <Link href="/admin" className="cg-link">
            Naar de admin
          </Link>
        )}
        <button type="submit">Uitloggen</button>
      </form>
    </article>
  );
}
