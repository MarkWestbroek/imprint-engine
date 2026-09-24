"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Client island for the tabs widget: the server renders every panel (all
 * content is in the HTML, good for search and for no-JS readers who get the
 * first panel), this switches which one is shown.
 */
export function Tabs({ labels, children }: { labels: string[]; children: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel-${i}`}
            onClick={() => setActive(i)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              i === active
                ? "border-accent font-semibold text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {children.map((panel, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`${id}-panel-${i}`}
          aria-labelledby={`${id}-tab-${i}`}
          hidden={i !== active}
          className="pt-4"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
