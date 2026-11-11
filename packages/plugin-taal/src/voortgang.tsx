"use client";

import { useEffect, useState } from "react";
import { VOORTGANG_KEY } from "./oefeningen";

/** The last score of a lesson in this browser, on the overview; nothing until the lesson was done. */
export function LesScore({ id, label }: { id: string; label: string }) {
  const [score, setScore] = useState<{ score: number; total: number } | null>(null);
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(VOORTGANG_KEY) ?? "{}") as Record<string, { score: number; total: number }>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage, unknown on the server
      if (all[id]) setScore(all[id]);
    } catch {
      // no storage: no score
    }
  }, [id]);
  if (!score) return null;
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      {label.replace("{score}", String(score.score)).replace("{totaal}", String(score.total))}
    </span>
  );
}
