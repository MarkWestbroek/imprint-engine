"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type GroupCard = {
  href: string;
  title: string;
  summary: string;
  image?: string;
  tags: string[];
  memberCount?: number;
  closed: boolean;
  membershipOnRequest: boolean;
};

const normalise = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** The group cards, filtered in the browser as you type (dozens of groups: all of them come along). */
export function GroupCards({ groups, showSearch }: { groups: GroupCard[]; showSearch: boolean }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const words = normalise(query).split(/\s+/).filter(Boolean);
    if (!words.length) return groups;
    return groups.filter((g) => {
      const hay = normalise(`${g.title} ${g.summary} ${g.tags.join(" ")}`);
      return words.every((w) => hay.includes(w));
    });
  }, [groups, query]);

  return (
    <div>
      {showSearch && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een community"
            aria-label="Zoek in de communities"
            className="w-full max-w-sm rounded-md border border-line bg-background px-3 py-2"
          />
          <span className="text-sm text-muted" aria-live="polite">
            {shown.length} van {groups.length}
          </span>
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((g) => (
          <li key={g.href}>
            <Link
              href={g.href}
              className="flex h-full flex-col overflow-hidden rounded-md border border-line bg-background transition-shadow hover:shadow-md"
            >
              {g.image && (
                // eslint-disable-next-line @next/next/no-img-element -- remote group image, sized by CSS
                <img src={g.image} alt="" className="aspect-[3/1] w-full object-cover" loading="lazy" />
              )}
              <span className="flex flex-1 flex-col p-5">
                <span className="text-xs text-muted">
                  Community
                  {g.closed ? " · besloten" : g.membershipOnRequest ? " · op aanvraag" : ""}
                </span>
                <span className="mt-1 block text-lg font-semibold text-accent">{g.title}</span>
                {g.summary && <span className="mt-2 block text-[15px] leading-relaxed">{g.summary}</span>}
                {g.memberCount !== undefined && (
                  <span className="mt-auto pt-3 text-sm text-muted">
                    {g.memberCount} {g.memberCount === 1 ? "lid" : "leden"}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-muted">Geen communities gevonden.</p>}
    </div>
  );
}
