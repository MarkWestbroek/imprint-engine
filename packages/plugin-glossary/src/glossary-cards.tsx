"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Card = { href: string; title: string; summary: string };

const normalise = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** The cards, filtered in the browser as you type (a glossary is small: all of it comes along). */
export function GlossaryCards({ terms, showSearch }: { terms: Card[]; showSearch: boolean }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const words = normalise(query).split(/\s+/).filter(Boolean);
    if (!words.length) return terms;
    return terms.filter((t) => {
      const hay = normalise(`${t.title} ${t.summary}`);
      return words.every((w) => hay.includes(w));
    });
  }, [terms, query]);

  return (
    <div>
      {showSearch && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek"
            aria-label="Zoek in de termen"
            className="w-full max-w-sm rounded-md border border-line bg-background px-3 py-2"
          />
          <span className="text-sm text-muted" aria-live="polite">
            {shown.length} van {terms.length}
          </span>
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="block h-full rounded-md border border-line bg-background p-5 transition-shadow hover:shadow-md"
            >
              <span className="text-xs text-muted">Term</span>
              <span className="mt-1 block text-lg font-semibold text-accent">{t.title}</span>
              {t.summary && <span className="mt-2 block text-[15px] leading-relaxed">{t.summary}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-muted">Geen termen gevonden.</p>}
    </div>
  );
}
