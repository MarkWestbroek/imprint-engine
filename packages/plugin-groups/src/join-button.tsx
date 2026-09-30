"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ActionResult, JoinStatus } from "./actions";
import { groupHref } from "./href";

/**
 * "Lid worden" on a prerendered group page: who is looking is asked in the
 * browser (the `status` action), so the HTML stays the same for everyone.
 * Without a dispatcher (no site actions) the button is only a promise.
 */
export function JoinButton({ slug, call, loginHref }: { slug: string; call?: PluginCall; loginHref: string }) {
  const [state, setState] = useState<JoinStatus | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!call) return;
    setState((await call("groups", "status", slug)) as JoinStatus | null);
  }, [call, slug]);

  useEffect(() => {
    refresh().catch(() => setState(null));
  }, [refresh]);

  const act = async (action: "join" | "leave") => {
    if (!call) return;
    setBusy(true);
    setError(null);
    const result = (await call("groups", action, slug)) as ActionResult;
    if (!result.ok) setError(result.error ?? "Dat lukte niet.");
    await refresh();
    setBusy(false);
  };

  const button = "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60";
  const quiet = "text-sm text-muted underline-offset-2 hover:underline";

  if (!call || state === undefined) {
    return (
      <button type="button" disabled className={button} title={call ? "Even geduld" : "Lid worden komt met de ledenfunctie"}>
        Lid worden
      </button>
    );
  }
  if (state === null) return null;
  if (!state.signedIn) {
    return (
      <Link href={loginHref} className={button}>
        Inloggen om lid te worden
      </Link>
    );
  }

  const m = state.membership;
  return (
    <div className="flex flex-col items-end gap-1 text-right">
      {m?.status === "active" ? (
        <>
          <span className="text-sm font-semibold">Je bent lid{m.role !== "member" ? ` (${m.role === "owner" ? "eigenaar" : "beheerder"})` : ""}</span>
          <span className="flex gap-3">
            {state.canManage && (
              <Link href={`${groupHref(slug)}/manage`} className={quiet}>
                Beheer
              </Link>
            )}
            {m.role !== "owner" && (
              <button type="button" onClick={() => act("leave")} disabled={busy} className={quiet}>
                Verlaten
              </button>
            )}
          </span>
        </>
      ) : m?.status === "requested" ? (
        <>
          <span className="text-sm font-semibold">Aanvraag ingediend</span>
          <button type="button" onClick={() => act("leave")} disabled={busy} className={quiet}>
            Intrekken
          </button>
        </>
      ) : !state.verified ? (
        <span className="text-sm text-muted">
          <Link href="/account" className="underline">
            Bevestig eerst je e-mailadres
          </Link>
        </span>
      ) : state.mode === "closed" ? (
        <span className="text-sm text-muted">Alleen op uitnodiging</span>
      ) : (
        <>
          <button type="button" onClick={() => act("join")} disabled={busy} className={button}>
            {state.mode === "request" ? "Lid worden (aanvraag)" : "Lid worden"}
          </button>
          {state.canManage && (
            <Link href={`${groupHref(slug)}/manage`} className={quiet}>
              Beheer
            </Link>
          )}
        </>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
