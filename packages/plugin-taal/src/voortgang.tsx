"use client";

import { useMemo } from "react";
import { useOpslag, VOORTGANG_KEY } from "./opslag";
import { leesVoortgang } from "./stand";

/** The best score of a lesson, on the overview; nothing until the lesson was done. */
export function LesScore({ id, label }: { id: string; label: string }) {
  const bewaard = useOpslag(VOORTGANG_KEY);
  const score = useMemo(() => leesVoortgang(bewaard)[id], [bewaard, id]);
  if (!score) return null;
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      {label.replace("{score}", String(score.score)).replace("{totaal}", String(score.total))}
    </span>
  );
}
