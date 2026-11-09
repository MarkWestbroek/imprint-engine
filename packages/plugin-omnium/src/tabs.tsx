"use client";

import { useId, useState, type ReactNode } from "react";

/** Tabs over server-rendered panels (the werkplaats's effect pane: Formulier, Beoordelen, Beschikking). */
export function Tabs({ tabs, label }: { tabs: { label: string; content: ReactNode }[]; label: string }) {
  const [on, setOn] = useState(0);
  const id = useId();
  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-3 flex gap-1 border-b border-line">
        {tabs.map((t, n) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            id={`${id}-tab-${n}`}
            aria-selected={n === on}
            aria-controls={`${id}-panel-${n}`}
            onClick={() => setOn(n)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${n === on ? "border-foreground font-medium" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, n) => (
        <div key={t.label} role="tabpanel" id={`${id}-panel-${n}`} aria-labelledby={`${id}-tab-${n}`} hidden={n !== on}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
