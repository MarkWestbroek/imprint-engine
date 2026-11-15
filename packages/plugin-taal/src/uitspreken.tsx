"use client";

import type { ReactNode } from "react";
import { browserVoice } from "./speak";

/**
 * A word or form of the language taught, in a grammar text: bold, and a
 * button that says it with the browser's voice (no recordings for the
 * reference). Rendered in place of `<strong>` by naslag.tsx.
 */
export function Uitspreken({ text, lang, label, children }: { text: string; lang: string; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      lang={lang}
      onClick={() => browserVoice(text, lang, false)}
      title={label}
      aria-label={`${label}: ${text}`}
      className="cursor-pointer font-semibold underline decoration-line decoration-dotted underline-offset-4 hover:text-accent hover:decoration-accent"
    >
      {children}
    </button>
  );
}
