"use client";

import { useRef, useState } from "react";
import { DefaultWidgetEditor, SchemaForm, type WidgetEditorProps } from "@imprint/runtime-admin/admin";
import { editorInputCls as inputCls, Mini2, omitProps, standardEditors } from "@imprint/widgets-standard/editors";

/**
 * The editor half of this site's own widgets (the viewer half lives in
 * components.tsx):
 *
 *   widget type = configschema (registry.ts)
 *               + viewer  — server component, renders the widget on the site
 *               + editor  — client component, edits the config in the studio
 *
 * The standard widgets bring their editors from `@imprint/widgets-standard`;
 * below are the two MusicBrain widgets that deserve more than the generated
 * form: the board's point picker and the kanban's column editor.
 */

export type { WidgetEditorProps };
export type WidgetEditor = (props: WidgetEditorProps) => React.ReactNode;

type BoardPoint = { x: number; y: number; label?: string; markdown: string };

function asPoints(value: unknown): BoardPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p) => {
    if (typeof p !== "object" || p === null) return [];
    const o = p as Record<string, unknown>;
    if (typeof o.x !== "number" || typeof o.y !== "number") return [];
    return [
      {
        x: o.x,
        y: o.y,
        label: typeof o.label === "string" ? o.label : undefined,
        markdown: typeof o.markdown === "string" ? o.markdown : "",
      },
    ];
  });
}

/** Point-picker for the board widget: click the render to drop a hotspot,
 * drag to move, edit label + markdown per point. */
function BoardEditor({ config, onChange }: WidgetEditorProps) {
  const title = typeof config.title === "string" ? config.title : "";
  const image = typeof config.image === "string" ? config.image : "";
  const alt = typeof config.alt === "string" ? config.alt : "";
  const mode = config.mode === "expanded" ? "expanded" : "hover";
  const points = asPoints(config.points);
  const [sel, setSel] = useState<number | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const drag = useRef<number | null>(null);
  const imgBox = useRef<HTMLDivElement>(null);

  const importJson = (raw: string) => {
    if (!raw.trim()) return;
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, unknown> = { ...config };
      if (typeof j.title === "string") next.title = j.title;
      if (typeof j.image === "string") next.image = j.image;
      if (typeof j.alt === "string") next.alt = j.alt;
      next.points = asPoints(j.points);
      onChange(next);
      setImportErr(null);
      setSel(null);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "invalid JSON");
    }
  };

  const patch = (next: Partial<typeof config>) => onChange({ ...config, ...next });
  const setPoints = (next: BoardPoint[]) => patch({ points: next });

  const relXY = (e: { clientX: number; clientY: number }) => {
    const r = imgBox.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const addAt = (e: React.MouseEvent) => {
    if (drag.current !== null) return; // ended a drag, not a click-add
    const { x, y } = relXY(e);
    const next = [...points, { x, y, markdown: "" }];
    setPoints(next);
    setSel(next.length - 1);
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          title
        </span>
        <input
          className={`mt-1 w-full ${inputCls}`}
          value={title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            image (URL or /public path)
          </span>
          <input
            className={`mt-1 w-full ${inputCls}`}
            value={image}
            placeholder="/boards/busboard-v2.png"
            onChange={(e) => patch({ image: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            alt
          </span>
          <input
            className={`mt-1 w-full ${inputCls}`}
            value={alt}
            onChange={(e) => patch({ alt: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            mode
          </span>
          <select
            className={`mt-1 ${inputCls}`}
            value={mode}
            onChange={(e) => patch({ mode: e.target.value })}
          >
            <option value="hover">hover</option>
            <option value="expanded">expanded</option>
          </select>
        </label>
      </div>

      {image ? (
        <div
          ref={imgBox}
          className="relative inline-block max-w-full cursor-crosshair select-none rounded-lg border border-line"
          onClick={addAt}
          onMouseMove={(e) => {
            if (drag.current === null) return;
            const { x, y } = relXY(e);
            const next = points.map((p, i) => (i === drag.current ? { ...p, x, y } : p));
            setPoints(next);
          }}
          onMouseUp={() => {
            // clear on the next tick so the click handler can see we dragged
            const was = drag.current;
            drag.current = null;
            if (was !== null) setSel(was);
          }}
          onMouseLeave={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- editor preview */}
          <img src={image} alt="" className="block h-auto max-w-full rounded-lg" draggable={false} />
          {points.map((p, i) => (
            <span
              key={i}
              role="button"
              tabIndex={0}
              aria-label={p.label ?? `point ${i + 1}`}
              className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white ${
                sel === i ? "bg-accent ring-2 ring-accent" : "bg-accent/70"
              }`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                drag.current = i;
                setSel(i);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Set an image URL to start placing points.</p>
      )}

      <ul className="space-y-2">
        {points.map((p, i) => (
          <li
            key={i}
            className={`rounded-lg border p-2 ${
              sel === i ? "border-accent" : "border-line"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSel(i)}
                className="text-xs font-mono text-muted hover:text-accent"
              >
                #{i + 1} · {(p.x * 100).toFixed(0)},{(p.y * 100).toFixed(0)}%
              </button>
              <input
                className={`${inputCls} flex-1`}
                placeholder="label (optional)"
                value={p.label ?? ""}
                onChange={(e) =>
                  setPoints(points.map((q, j) => (j === i ? { ...q, label: e.target.value } : q)))
                }
              />
              <button
                type="button"
                onClick={() => {
                  setPoints(points.filter((_, j) => j !== i));
                  setSel(null);
                }}
                className="text-xs text-muted hover:text-red-400"
              >
                ✕
              </button>
            </div>
            <textarea
              className={`${inputCls} w-full font-mono`}
              rows={2}
              placeholder="markdown shown on hover"
              value={p.markdown}
              onChange={(e) =>
                setPoints(points.map((q, j) => (j === i ? { ...q, markdown: e.target.value } : q)))
              }
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Click the render to add a point; drag a point to move it.</p>

      <details className="rounded-lg border border-line p-2">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted">
          Import exported config (widget_export.py)
        </summary>
        <textarea
          className={`${inputCls} mt-2 w-full font-mono`}
          rows={3}
          placeholder='Paste <board>-widget.json here — fills image + all points at once'
          onChange={(e) => importJson(e.target.value)}
        />
        {importErr && <p className="mt-1 text-xs text-red-400">{importErr}</p>}
      </details>
    </div>
  );
}

type KanbanCard = { text: string; tone?: string };
type KanbanColumn = { title: string; cards: KanbanCard[] };

/** Board editor for the kanban widget: columns with cards, move with arrows. */
function KanbanEditor({ config, onChange, schema }: WidgetEditorProps) {
  const columns = (Array.isArray(config.columns) ? config.columns : []) as KanbanColumn[];
  const set = (next: KanbanColumn[]) => onChange({ ...config, columns: next });
  const patchCol = (c: number, patch: Partial<KanbanColumn>) =>
    set(columns.map((col, idx) => (idx === c ? { ...col, ...patch } : col)));
  const moveCard = (c: number, i: number, dir: "up" | "down" | "left" | "right") => {
    const next = structuredClone(columns);
    const cards = next[c].cards;
    if (dir === "up" || dir === "down") {
      const to = dir === "up" ? i - 1 : i + 1;
      if (to < 0 || to >= cards.length) return;
      [cards[i], cards[to]] = [cards[to], cards[i]];
    } else {
      const to = dir === "left" ? c - 1 : c + 1;
      if (to < 0 || to >= next.length) return;
      const [card] = cards.splice(i, 1);
      next[to].cards.push(card);
    }
    set(next);
  };

  return (
    <div className="space-y-3">
      <SchemaForm schema={omitProps(schema, ["columns"])} value={config} onChange={onChange} />
      <div className="space-y-2">
        {columns.map((col, c) => (
          <div key={c} className="rounded-lg border border-line p-2">
            <div className="flex gap-1.5">
              <input
                className={`${inputCls} flex-1 font-semibold`}
                placeholder="kolomtitel"
                value={col.title}
                onChange={(e) => patchCol(c, { title: e.target.value })}
              />
              <Mini2 label="✕ col" onClick={() => set(columns.filter((_, idx) => idx !== c))} />
            </div>
            <div className="mt-1.5 space-y-1.5">
              {col.cards.map((card, i) => (
                <div key={i} className="rounded-md border border-line p-1.5">
                  <textarea
                    className={`${inputCls} w-full`}
                    rows={2}
                    value={card.text}
                    onChange={(e) =>
                      patchCol(c, {
                        cards: col.cards.map((cd, idx) =>
                          idx === i ? { ...cd, text: e.target.value } : cd
                        ),
                      })
                    }
                  />
                  <div className="mt-1 flex items-center gap-1">
                    <select
                      className={`${inputCls} text-xs`}
                      value={card.tone ?? "default"}
                      onChange={(e) =>
                        patchCol(c, {
                          cards: col.cards.map((cd, idx) =>
                            idx === i ? { ...cd, tone: e.target.value } : cd
                          ),
                        })
                      }
                    >
                      {["default", "accent", "warning", "success"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <Mini2 label="↑" onClick={() => moveCard(c, i, "up")} />
                    <Mini2 label="↓" onClick={() => moveCard(c, i, "down")} />
                    <Mini2 label="◀" title="Naar kolom links" onClick={() => moveCard(c, i, "left")} />
                    <Mini2 label="▶" title="Naar kolom rechts" onClick={() => moveCard(c, i, "right")} />
                    <Mini2
                      label="✕"
                      onClick={() =>
                        patchCol(c, { cards: col.cards.filter((_, idx) => idx !== i) })
                      }
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => patchCol(c, { cards: [...col.cards, { text: "" }] })}
                className="w-full rounded-md border border-dashed border-line py-1 text-xs text-muted hover:border-accent hover:text-accent"
              >
                ＋ kaart
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set([...columns, { title: `Kolom ${columns.length + 1}`, cards: [] }])}
          className="rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          ＋ kolom
        </button>
      </div>
    </div>
  );
}

/** Custom editors per widget type; absent = schema-generated form. */
export const widgetEditors: Record<string, WidgetEditor> = {
  ...standardEditors,
  board: BoardEditor,
  kanban: KanbanEditor,
};

/** This site's widget editor for the studio (AdminContext.studio.editor). */
export function WidgetEditorFor(props: WidgetEditorProps) {
  const Custom = widgetEditors[props.type];
  return Custom ? <Custom {...props} /> : <DefaultWidgetEditor {...props} />;
}
