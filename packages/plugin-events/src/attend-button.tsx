"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { AttendanceStatus } from "@imprint/content-core/user-store";
import type { ActionResult, AttendStatus } from "./actions";
import { eventHref } from "./href";

const LABEL: Record<AttendanceStatus, string> = { attending: "Ik kom", maybe: "Misschien", not: "Ik kom niet" };

/**
 * Komt / misschien / komt niet, on a prerendered event page: who is looking
 * is asked in the browser (the `status` action), so the HTML is the same for
 * everyone. The privacy text stands with the buttons; choosing is agreeing.
 */
export function AttendButton({ slug, call, loginHref, organizer }: { slug: string; call?: PluginCall; loginHref: string; organizer: string }) {
  const [state, setState] = useState<AttendStatus | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!call) return;
    setState((await call("events", "status", slug)) as AttendStatus | null);
  }, [call, slug]);

  useEffect(() => {
    refresh().catch(() => setState(null));
  }, [refresh]);

  const answer = async (choice: AttendanceStatus | "withdraw") => {
    if (!call) return;
    setBusy(true);
    setError(null);
    const result = (choice === "withdraw"
      ? await call("events", "withdraw", slug)
      : await call("events", "attend", slug, choice)) as ActionResult;
    if (!result.ok) setError(result.error ?? "Dat lukte niet.");
    await refresh();
    setBusy(false);
  };

  if (!call || state === undefined) return <p className="text-sm text-muted">Aanmelden…</p>;
  if (state === null || !state.open) return null;

  const tally = (
    <p className="text-sm text-muted">
      {state.counts.attending} {state.counts.attending === 1 ? "komt" : "komen"}
      {state.counts.maybe > 0 && ` · ${state.counts.maybe} misschien`}
      {state.full && " · vol"}
    </p>
  );

  if (!state.signedIn) {
    return (
      <div className="space-y-2">
        {tally}
        <Link href={loginHref} className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong">
          Inloggen om je aan te melden
        </Link>
      </div>
    );
  }
  if (!state.verified) {
    return (
      <div className="space-y-2">
        {tally}
        <p className="text-sm text-muted">
          <Link href="/account" className="underline">
            Bevestig eerst je e-mailadres
          </Link>{" "}
          om je aan te melden.
        </p>
      </div>
    );
  }

  const base = "rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60";
  const chosen = "border-accent bg-accent text-background";
  const plain = "border-line bg-background hover:bg-surface";
  return (
    <div className="space-y-3">
      {tally}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABEL) as AttendanceStatus[]).map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={busy || (choice === "attending" && state.full && state.mine !== "attending")}
            onClick={() => answer(choice)}
            className={`${base} ${state.mine === choice ? chosen : plain}`}
            aria-pressed={state.mine === choice}
          >
            {LABEL[choice]}
          </button>
        ))}
        {state.mine && (
          <button type="button" disabled={busy} onClick={() => answer("withdraw")} className="text-sm text-muted underline-offset-2 hover:underline">
            Aanmelding intrekken
          </button>
        )}
      </div>
      {state.canManage && (
        <p className="text-sm">
          <Link href={`${eventHref(slug)}/attendees`} className="text-accent underline">
            Aanmeldingen bekijken
          </Link>
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-muted">
        Met je keuze ga je ermee akkoord dat de organisatie{organizer ? ` (${organizer})` : ""} je naam en e-mailadres ziet om je over
        dit evenement te informeren. Na afloop worden de aanmeldingen opgeruimd; intrekken kan altijd.
      </p>
    </div>
  );
}
