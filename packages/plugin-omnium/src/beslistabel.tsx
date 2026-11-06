import type { ReactNode } from "react";
import { ResizableTable } from "./resizable-table";

/**
 * A DMN decision table, read as a table: one column per input, then the
 * outputs, one row per rule. Two sources give the same shape:
 * - a dmn-bron (Omnium's own JSON): `profielen.*.elements.*.data.beslistabel`
 *   on the element of type decision, with the question in `data.vraag`;
 * - a generated DMN (XML for GZAC/Operaton): `decisionTable` per `decision`.
 */

export type Kolom = { id: string; label: string; expressie?: string; veldpad?: string };
export type Regel = { id?: string; toelichting?: string; in: string[]; out: string[] };
export type Beslistabel = {
  id?: string;
  naam?: string;
  vraag?: string;
  hitPolicy?: string;
  inputs: Kolom[];
  outputs: Kolom[];
  rules: Regel[];
};

const obj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : v === undefined || v === null ? undefined : String(v));

/** The decision tables in a dmn-bron (Omnium JSON); empty when there are none. */
export function fromBron(json: unknown): Beslistabel[] {
  const out: Beslistabel[] = [];
  for (const profiel of Object.values(obj(obj(json)?.profielen) ?? {})) {
    for (const [key, el] of Object.entries(obj(obj(profiel)?.elements) ?? {})) {
      const data = obj(obj(el)?.data);
      const t = obj(data?.beslistabel);
      if (!t) continue;
      const kolom = (k: unknown): Kolom => {
        const c = obj(k) ?? {};
        return {
          id: str(c.id) ?? "",
          label: str(c.label) ?? str(c.naam) ?? "",
          expressie: str(c.expressie) ?? str(c.naam),
          veldpad: str(obj(c.fieldRef)?.veldpad),
        };
      };
      const inputs = arr(t.inputs).map(kolom);
      const outputs = arr(t.outputs).map(kolom);
      out.push({
        id: str(obj(el)?.id) ?? key,
        naam: str(t.naam) ?? str(obj(el)?.naam),
        vraag: str(data?.vraag),
        hitPolicy: str(t.hitPolicy),
        inputs,
        outputs,
        rules: arr(t.rules).map((r) => {
          const rule = obj(r) ?? {};
          const ins = obj(rule.inputEntries) ?? {};
          const outs = obj(rule.outputEntries) ?? {};
          return {
            id: str(rule.id),
            toelichting: str(rule.toelichting),
            in: inputs.map((c) => str(ins[c.id]) ?? ""),
            out: outputs.map((c) => str(outs[c.id]) ?? ""),
          };
        }),
      });
    }
  }
  return out;
}

const ENTITIES: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m)
  );
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]!) : undefined;
};
/** Elements by local name, whatever the prefix (`dmn:`, none, …): [open tag, inner XML]. */
function elements(xml: string, name: string): [string, string][] {
  const re = new RegExp(`<((?:[\\w-]+:)?${name})\\b([^>]*?)(?:/>|>([\\s\\S]*?)</\\1>)`, "g");
  return [...xml.matchAll(re)].map((m) => [m[2] ?? "", m[3] ?? ""]);
}
const text = (inner: string) => {
  const t = elements(inner, "text")[0];
  return t ? decode(t[1]).trim() : "";
};

/** The decision tables in DMN XML; empty when it does not parse as one. */
export function fromXml(xml: string): Beslistabel[] {
  return elements(xml, "decision").flatMap(([tag, inner]) =>
    elements(inner, "decisionTable").map(([tTag, t]) => {
      const inputs = elements(t, "input").map(([a, b]) => ({
        id: attr(a, "id") ?? "",
        label: attr(a, "label") ?? text(b),
        expressie: text(elements(b, "inputExpression")[0]?.[1] ?? "") || undefined,
      }));
      const outputs = elements(t, "output").map(([a]) => ({
        id: attr(a, "id") ?? "",
        label: attr(a, "label") ?? attr(a, "name") ?? "",
        expressie: attr(a, "name"),
      }));
      return {
        id: attr(tag, "id"),
        naam: attr(tag, "name"),
        hitPolicy: attr(tTag, "hitPolicy") ?? "UNIQUE",
        inputs,
        outputs,
        rules: elements(t, "rule").map(([a, r]) => {
          const d = elements(r, "description")[0];
          return {
            id: attr(a, "id"),
            toelichting: d ? decode(d[1]).trim() : undefined,
            in: elements(r, "inputEntry").map(([, e]) => text(e)),
            out: elements(r, "outputEntry").map(([, e]) => text(e)),
          };
        }),
      };
    })
  );
}

/** What the hit policy means for a reader. */
const HIT_POLICY: Record<string, string> = {
  UNIQUE: "precies één regel past",
  FIRST: "de eerste regel die past, telt",
  PRIORITY: "de regel met de hoogste prioriteit telt",
  ANY: "alle passende regels geven hetzelfde",
  COLLECT: "alle passende regels tellen",
  "RULE ORDER": "alle passende regels, in volgorde",
  "OUTPUT ORDER": "alle passende regels, op uitkomst",
};

/** "-" and "" both mean: any value. */
const Entry = ({ v }: { v: string }) =>
  v === "" || v === "-" ? <span className="text-muted">–</span> : <code className="break-words font-mono text-xs">{v}</code>;

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`py-2 pr-4 align-bottom font-medium ${className}`}>{children}</th>;
}

export function BeslistabelView({ tabel, href }: { tabel: Beslistabel; href?: string }) {
  const hp = tabel.hitPolicy?.toUpperCase();
  return (
    <section className="space-y-3">
      <header>
        <h3 className="font-semibold">{href ? <a href={href} className="underline-offset-2 hover:underline">{tabel.naam ?? tabel.id}</a> : (tabel.naam ?? tabel.id)}</h3>
        {tabel.vraag && <p className="text-sm">{tabel.vraag}</p>}
        {hp && (
          <p className="text-sm text-muted">
            Hit policy {hp}
            {HIT_POLICY[hp] ? `: ${HIT_POLICY[hp]}.` : ""} Een streepje betekent: elke waarde.
          </p>
        )}
      </header>
      <div className="overflow-x-auto">
        <ResizableTable className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <Th>#</Th>
              {tabel.inputs.map((c, n) => (
                <Th key={`i${n}`}>
                  <span className="block text-foreground">{c.label}</span>
                  {c.expressie && c.expressie !== c.label && <code className="block font-mono text-xs font-normal">{c.expressie}</code>}
                  {c.veldpad && <span className="block text-xs font-normal">uit {c.veldpad}</span>}
                </Th>
              ))}
              {tabel.outputs.map((c, n) => (
                <Th key={`o${n}`} className={n === 0 ? "border-l-2 border-line pl-4" : ""}>
                  <span className="block text-foreground">{c.label}</span>
                  {c.expressie && c.expressie !== c.label && <code className="block font-mono text-xs font-normal">{c.expressie}</code>}
                </Th>
              ))}
              <Th>Toelichting</Th>
            </tr>
          </thead>
          <tbody>
            {tabel.rules.map((r, n) => (
              <tr key={n} className="border-b border-line/60 align-top">
                <td className="py-2 pr-4 text-muted">{n + 1}</td>
                {tabel.inputs.map((_, m) => (
                  <td key={`i${m}`} className="py-2 pr-4"><Entry v={r.in[m] ?? ""} /></td>
                ))}
                {tabel.outputs.map((_, m) => (
                  <td key={`o${m}`} className={`py-2 pr-4 ${m === 0 ? "border-l-2 border-line pl-4" : ""}`}><Entry v={r.out[m] ?? ""} /></td>
                ))}
                <td className="py-2 pr-4">{r.toelichting}</td>
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      </div>
    </section>
  );
}
