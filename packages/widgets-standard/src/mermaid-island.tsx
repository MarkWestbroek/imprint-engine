"use client";

import { useEffect, useId, useState } from "react";

/**
 * Client island for the mermaid widget. Mermaid needs a DOM to lay out, so
 * the diagram is drawn in the browser; the library (MIT, large) is loaded
 * lazily and only on pages that have one. Until then — and for search
 * engines — the source is on the page as a code block.
 */
export function MermaidDiagram({ code, theme }: { code: string; theme: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme as "default",
          securityLevel: "strict",
          suppressErrorRendering: true,
        });
        const out = await mermaid.render(`mermaid-${id}`, code);
        if (!cancelled) setSvg(out.svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, theme, id]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/50 bg-surface p-3 text-xs">
        <p className="mb-2 font-semibold text-red-400">Diagram error: {error}</p>
        <pre className="whitespace-pre-wrap font-mono text-muted">{code}</pre>
      </div>
    );
  }
  if (!svg) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs text-muted">
        {code}
      </pre>
    );
  }
  return (
    <div
      className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
