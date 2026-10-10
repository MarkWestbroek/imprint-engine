"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ModerateResult } from "./moderation-actions";

type Props = {
  slug: string;
  pool: string;
  license: string;
  /** The patch is the signed-in editor's own: they may make it CC0 on the way to centraal. */
  own: boolean;
  answered: boolean;
  call: PluginCall;
};

/** The moderator's buttons on one patch: to the lab, to centraal, answered, reject. Two clicks for the irreversible-looking ones. */
export function ModerateButtons({ slug, pool, license, own, answered, call }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"reject" | "cc0" | null>(null);

  const run = async (action: string, ...args: unknown[]) => {
    setBusy(true);
    setError(null);
    const result = (await call("patches", action, slug, ...args)) as ModerateResult;
    setBusy(false);
    setConfirming(null);
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    router.refresh();
  };

  const btn = "rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50";
  const primary = "rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50";
  const cc0Needed = license !== "CC0";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {pool !== "centraal" &&
          (cc0Needed && own ? (
            confirming === "cc0" ? (
              <button type="button" disabled={busy} className={primary} onClick={() => run("moderate", "centraal", { cc0: true })}>
                Ja, als CC0 naar centraal
              </button>
            ) : (
              <button type="button" disabled={busy} className={primary} onClick={() => setConfirming("cc0")}>
                Naar centraal (wordt CC0)
              </button>
            )
          ) : (
            <button
              type="button"
              disabled={busy || cc0Needed}
              className={primary}
              title={cc0Needed ? `De inzender koos ${license}; de centrale set is CC0` : undefined}
              onClick={() => run("moderate", "centraal")}
            >
              Naar centraal
            </button>
          ))}
        {pool !== "experimenteel" && (
          <button type="button" disabled={busy} className={btn} onClick={() => run("moderate", "experimenteel")}>
            Naar het lab
          </button>
        )}
        {pool === "vraag" && (
          <button type="button" disabled={busy} className={btn} onClick={() => run("answered", !answered)}>
            {answered ? "Niet meer beantwoord" : "Beantwoord"}
          </button>
        )}
        {pool !== "voorstel" && pool !== "vraag" && (
          <button type="button" disabled={busy} className={btn} onClick={() => run("moderate", "voorstel")}>
            Terug naar voorstel
          </button>
        )}
        {confirming === "reject" ? (
          <>
            <button type="button" disabled={busy} className={`${btn} border-red-400 text-red-500`} onClick={() => run("reject")}>
              Ja, afwijzen
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(null)}>
              Annuleren
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} className={`${btn} text-muted`} onClick={() => setConfirming("reject")}>
            Afwijzen
          </button>
        )}
      </div>
      {cc0Needed && !own && pool !== "centraal" && <p className="text-xs text-muted">Naar centraal kan pas als de inzender CC0 kiest; de centrale set is vrij van voorwaarden.</p>}
      {confirming === "reject" && <p className="text-xs text-muted">De patch verdwijnt uit alle pools; onder Geschiedenis is hij terug te halen.</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
