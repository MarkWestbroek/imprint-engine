import type { ReactNode } from "react";

/**
 * JSON as a tree you can fold open (server-rendered, `<details>`, no client
 * code): objects and arrays are branches with their size, values are typed
 * leaves. The first level is open; deeper levels start closed, so a large
 * payload (a form definition, a Studio model) stays readable.
 */

const MAX_NODES = 5000;

function Leaf({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted">null</span>;
  if (typeof value === "string") {
    return /^https?:\/\/\S+$/.test(value) ? (
      <a href={value} className="break-all text-accent-2 underline-offset-2 hover:underline" rel="noopener noreferrer">
        &quot;{value}&quot;
      </a>
    ) : (
      <span className="break-words text-accent-2">&quot;{value}&quot;</span>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") return <span className="text-accent">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

export function JsonTree({ value, open = 1 }: { value: unknown; open?: number }) {
  let budget = MAX_NODES;
  const node = (key: string | null, v: unknown, depth: number): ReactNode => {
    if (--budget < 0) return null;
    const label = key === null ? null : <span className="text-muted">{key}: </span>;
    if (v && typeof v === "object") {
      const entries = Array.isArray(v) ? v.map((x, n) => [String(n), x] as const) : Object.entries(v);
      const size = Array.isArray(v) ? `[${entries.length}]` : `{${entries.length}}`;
      return (
        <details open={depth < open} className="pl-4 [&>summary]:-ml-4">
          <summary className="cursor-pointer select-none">
            {label}
            <span className="text-muted">{size}</span>
          </summary>
          <div>
            {entries.map(([k, x]) => (
              <div key={k}>{node(k, x, depth + 1)}</div>
            ))}
          </div>
        </details>
      );
    }
    return (
      <div className="pl-4">
        {label}
        <Leaf value={v} />
      </div>
    );
  };
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-line bg-white p-3 font-mono text-xs leading-relaxed">
      {node(null, value, 0)}
      {budget < 0 && <p className="mt-2 text-muted">… ingekort (meer dan {MAX_NODES} onderdelen)</p>}
    </div>
  );
}

/** A string that holds a JSON object or array, parsed; undefined otherwise. */
export function parseJsonish(s: string): object | undefined {
  const t = s.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return undefined;
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}
