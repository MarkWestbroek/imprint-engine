"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";

/**
 * Markdown field with a live "onderwater" preview: you type source, the
 * rendered result appears right below — through the site's own Markdown
 * renderer, so the preview matches the site exactly. A heavier WYSIWYG
 * (Milkdown, TipTap, …) can replace this later without touching callers.
 */
export function MarkdownEditor({
  value,
  onChange,
  rows = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const [showPreview, setShowPreview] = useState(true);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <textarea
        className="block w-full resize-y bg-background px-2.5 py-1.5 font-mono text-sm focus:outline-none"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Markdown…"
      />
      <button
        type="button"
        onClick={() => setShowPreview(!showPreview)}
        className="flex w-full items-center gap-2 border-t border-line bg-surface px-2.5 py-1 text-left text-xs text-muted hover:text-foreground"
      >
        {showPreview ? "▾" : "▸"} preview
      </button>
      {showPreview && (
        <div className="border-t border-line bg-surface/50 px-3 py-2 text-sm">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-muted">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
