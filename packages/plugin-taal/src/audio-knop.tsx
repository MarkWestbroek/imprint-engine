"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { AudioResult } from "./actions";

/** One lesson's "make the missing recordings" button, with what it will ask for. */
export function AudioKnop({ id, ontbreekt, tekens, hergebruik, call }: { id: string; ontbreekt: number; tekens: number; hergebruik: number; call: PluginCall }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setMelding(null);
    const r = (await call("taal", "genereerAudio", id)) as AudioResult;
    setBusy(false);
    const gedaan = `${r.gemaakt ?? 0} gemaakt, ${r.hergebruikt ?? 0} overgenomen`;
    setMelding(r.ok ? { ok: true, tekst: gedaan } : { ok: false, tekst: `${r.error ?? "Dat lukte niet."} (${gedaan})` });
    router.refresh();
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
      >
        {busy ? "Bezig…" : ontbreekt > 0 ? `Genereer ${ontbreekt} opnamen (${tekens} tekens)` : `Neem ${hergebruik} opnamen over`}
      </button>
      {melding && (
        <p role="status" className={melding.ok ? "text-sm text-muted" : "text-sm font-semibold text-foreground"}>
          {melding.tekst}
        </p>
      )}
    </div>
  );
}
