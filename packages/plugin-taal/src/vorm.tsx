"use client";

import { useSyncExternalStore } from "react";
import { vormen, type Vorm } from "./tekst";

/**
 * The learner's choice between the masculine and the feminine forms (tekst.ts),
 * kept in this browser like the score. The server and the first render know no
 * choice and show both forms; the choice comes in right after.
 */
export const VORM_KEY = "taal-vorm";

const luisteraars = new Set<() => void>();

function lees(): Vorm | null {
  try {
    const v = localStorage.getItem(VORM_KEY);
    return v === "m" || v === "v" ? v : null;
  } catch {
    return null;
  }
}

function volg(cb: () => void) {
  luisteraars.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    luisteraars.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export const useVorm = (): Vorm | null => useSyncExternalStore(volg, lees, () => null);

function zetVorm(vorm: Vorm | null) {
  try {
    if (vorm) localStorage.setItem(VORM_KEY, vorm);
    else localStorage.removeItem(VORM_KEY);
  } catch {
    // no storage (private mode): both forms stay
  }
  luisteraars.forEach((cb) => cb());
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
      onClick={() => zetVorm(waarde)}
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
