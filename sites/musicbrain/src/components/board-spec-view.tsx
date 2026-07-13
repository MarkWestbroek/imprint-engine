import type { BoardSpec } from "@imprint/content-core";
import { boardSpecToBoardConfig } from "@imprint/content-core";
import { Markdown } from "@/components/markdown";
import { BoardSpecMedia } from "@/components/board-spec-media";

/**
 * Renders a board-spec with low authoring burden (D9). The render is hybrid
 * (BoardSpecMedia: static overview, plus an interactive hover view when the
 * spec has points, D4/D10). The dense connector table and pinout grid sit in
 * collapsed <details> so the default view stays calm; `compact` (product page)
 * trims to just the render + connectors.
 */
export function BoardSpecView({
  spec,
  compact = false,
}: {
  spec: BoardSpec;
  compact?: boolean;
}) {
  const derived = boardSpecToBoardConfig(spec);
  const pinouts = Object.entries(spec.assets.pinouts);

  return (
    <div className="space-y-4">
      <BoardSpecMedia overview={spec.assets.overview} board={derived} />

      {spec.connectors.length > 0 && (
        <details className="rounded-lg border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted">
            Connectors ({spec.connectors.length})
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {spec.connectors.map((c) => (
                  <tr key={c.ref} className="border-b border-line align-top">
                    <td className="py-1.5 pr-4 font-mono whitespace-nowrap">
                      {c.ref}
                      {c.label && <span className="text-muted"> · {c.label}</span>}
                    </td>
                    <td className="py-1.5 font-mono text-xs">
                      {c.pins.map((p) => `${p.pin}→${p.net}`).join("  ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {!compact && pinouts.length > 0 && (
        <details className="rounded-lg border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted">
            Pinout diagrams ({pinouts.length})
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {pinouts.map(([ref, url]) => (
              <figure key={ref} className="rounded-lg border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- stored pinout SVG */}
                <img src={url} alt={`Pinout ${ref}`} className="max-w-full" />
                <figcaption className="mt-1 text-xs text-muted">{ref}</figcaption>
              </figure>
            ))}
          </div>
        </details>
      )}

      {!compact &&
        spec.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h3 className="mb-1 text-base font-semibold">{s.heading}</h3>}
            <Markdown>{s.markdown}</Markdown>
          </section>
        ))}
    </div>
  );
}
