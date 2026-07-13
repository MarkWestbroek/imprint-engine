import type { BoardSpec } from "@imprint/content-core";
import { boardSpecToBoardConfig } from "@imprint/content-core";
import { Markdown } from "@/components/markdown";
import { BoardCanvas } from "@/widgets/board-canvas";

/**
 * Renders a board-spec with low authoring burden (D9): the interactive hotspot
 * render when the spec has points (derived via boardSpecToBoardConfig, D4),
 * else the overview image; then the connectors table, the pinout SVGs, and the
 * prose sections. `compact` trims it for embedding on a product page.
 */
export function BoardSpecView({
  spec,
  compact = false,
}: {
  spec: BoardSpec;
  compact?: boolean;
}) {
  const derived = boardSpecToBoardConfig(spec);
  const hasBoard = derived.image !== "" && derived.points.length > 0;

  return (
    <div className="space-y-4">
      {hasBoard ? (
        <BoardCanvas
          image={derived.image}
          alt={derived.alt}
          points={derived.points}
          mode="hover"
        />
      ) : (
        spec.assets.overview && (
          // eslint-disable-next-line @next/next/no-img-element -- stored render
          <img
            src={spec.assets.overview}
            alt={`${spec.component} ${spec.version}`}
            className="h-auto max-w-full rounded-lg"
          />
        )
      )}

      {spec.connectors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-4">Connector</th>
                <th className="py-1.5 pr-4">Pins (pin → net)</th>
              </tr>
            </thead>
            <tbody>
              {spec.connectors.map((c) => (
                <tr key={c.ref} className="border-b border-line align-top">
                  <td className="py-1.5 pr-4 font-mono">
                    {c.ref}
                    {c.label && <span className="text-muted"> · {c.label}</span>}
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-xs">
                    {c.pins.map((p) => `${p.pin}→${p.net}`).join("  ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!compact &&
        Object.entries(spec.assets.pinouts).length > 0 &&
        !hasBoard && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(spec.assets.pinouts).map(([ref, url]) => (
              <figure key={ref} className="rounded-lg border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- stored pinout SVG */}
                <img src={url} alt={`Pinout ${ref}`} className="max-w-full" />
                <figcaption className="mt-1 text-xs text-muted">{ref}</figcaption>
              </figure>
            ))}
          </div>
        )}

      {!compact &&
        spec.sections.map((s, i) => (
          <section key={i}>
            {s.heading && (
              <h3 className="mb-1 text-base font-semibold">{s.heading}</h3>
            )}
            <Markdown>{s.markdown}</Markdown>
          </section>
        ))}
    </div>
  );
}
