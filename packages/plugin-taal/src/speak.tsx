"use client";

import { localeOf } from "./tekst";

type Props = {
  text: string;
  lang: string;
  /** The recordings that exist for this sentence; without one the browser's own voice reads it. */
  audio?: { normal?: string; slow?: string };
  labels: { speel: string; langzaam: string };
};

function browserVoice(text: string, lang: string, slow: boolean) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = localeOf(lang);
  u.rate = slow ? 0.7 : 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Two small play buttons for one sentence: normal and slow. */
export function Speak({ text, lang, audio, labels }: Props) {
  const play = (tempo: "normal" | "slow") => {
    const url = audio?.[tempo];
    const fallback = () => browserVoice(text, lang, tempo === "slow");
    if (!url) return fallback();
    // A recording that does not load (removed, offline) falls back as well.
    new Audio(url).play().catch(fallback);
  };
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-background text-sm hover:border-accent hover:text-accent";
  return (
    <span className="inline-flex gap-1 align-middle">
      <button type="button" className={btn} onClick={() => play("normal")} aria-label={`${labels.speel}: ${text}`} title={labels.speel}>
        <span aria-hidden>▶</span>
      </button>
      <button type="button" className={btn} onClick={() => play("slow")} aria-label={`${labels.langzaam}: ${text}`} title={labels.langzaam}>
        <span aria-hidden>🐢</span>
      </button>
    </span>
  );
}
