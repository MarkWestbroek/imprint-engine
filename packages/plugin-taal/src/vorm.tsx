"use client";

import { bewaarVorm, useOpslag, VORM_KEY } from "./opslag";
import { isVorm } from "./stand";
import { vormen, type Vorm } from "./tekst";

/**
 * The learner's choice between the masculine and the feminine forms (tekst.ts),
 * kept like the score (opslag.ts). The server and the first render know no
 * choice and show both forms; the choice comes in right after.
 */
export function useVorm(): Vorm | null {
  const bewaard = useOpslag(VORM_KEY);
  return isVorm(bewaard) ? bewaard : null;
}

/** A text with its forms, in the learner's choice. */
export function Vormen({ children }: { children: string }) {
  return <>{vormen(children, useVorm())}</>;
}

export type VormLabels = { vraag: string; m: string; v: string; beide: string };

/** The choice itself: three small buttons. */
export function VormKeuze({ labels }: { labels: VormLabels }) {
  const vorm = useVorm();
  const knop = (waarde: Vorm | null, label: string) => (
    <button
      type="button"
      aria-pressed={vorm === waarde}
      onClick={() => bewaarVorm(waarde)}
      className={`rounded-full border px-3 py-0.5 ${vorm === waarde ? "border-accent font-semibold text-accent" : "border-line hover:border-accent"}`}
    >
      {label}
    </button>
  );
  return (
    <p role="group" aria-label={labels.vraag} className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span>{labels.vraag}</span>
      {knop("m", labels.m)}
      {knop("v", labels.v)}
      {knop(null, labels.beide)}
    </p>
  );
}
