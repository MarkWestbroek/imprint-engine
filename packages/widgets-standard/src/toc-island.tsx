"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; text: string; level: number };

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Client island for the table-of-contents widget: after mount it collects
 * the page's h2/h3 headings (whatever widget they came from), gives any
 * heading without an id one, and lists them as anchor links. On the server
 * it renders nothing, so the static HTML carries only the frame.
 */
export function TocList({ depth }: { depth: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    const seen = new Set<string>();
    const found: Entry[] = [];
    root.querySelectorAll<HTMLHeadingElement>(depth >= 3 ? "h2, h3" : "h2").forEach((h) => {
      if (h.closest("[data-toc]")) return;
      const text = h.textContent?.trim() ?? "";
      if (!text) return;
      let id = h.id || slug(text) || "section";
      while (seen.has(id)) id += "-";
      seen.add(id);
      h.id = id;
      found.push({ id, text, level: Number(h.tagName.slice(1)) });
    });
    setEntries(found);
  }, [depth]);

  if (!entries) return null;
  if (entries.length === 0) return <p className="text-sm text-muted">No headings on this page yet.</p>;
  return (
    <ol className="space-y-1 text-sm">
      {entries.map((e) => (
        <li key={e.id} className={e.level >= 3 ? "pl-4" : ""}>
          <a href={`#${e.id}`} className="text-muted hover:text-accent">
            {e.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
