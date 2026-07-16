"use client";

import { useRef, useState } from "react";
import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "@/components/admin/schema-form";

/**
 * The editor half of a widget (the viewer half lives in components.tsx):
 *
 *   widget type = configschema (registry.ts)
 *               + viewer  — server component, renders the widget on the site
 *               + editor  — client component, edits the config in the studio
 *
 * Most widgets don't need a hand-written editor: the default renders the
 * form generated from the config schema. Add an entry to `widgetEditors`
 * only when a widget deserves richer editing (e.g. the table grid below, or
 * a map/point picker for an annotated-image widget).
 */

export type WidgetEditorProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** JSON Schema generated from the widget's zod config schema. */
  schema: JsonSchema;
};
export type WidgetEditor = (props: WidgetEditorProps) => React.ReactNode;

const inputCls =
  "rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";

/** Grid editor for the table widget: edit headers/cells, add/remove rows & columns. */
function TableEditor({ config, onChange }: WidgetEditorProps) {
  const title = typeof config.title === "string" ? config.title : "";
  const headers = Array.isArray(config.headers) ? (config.headers as string[]) : [];
  const rows = Array.isArray(config.rows) ? (config.rows as string[][]) : [];
  const striped = config.striped !== false;
  const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);

  const patch = (next: Partial<typeof config>) => onChange({ ...config, ...next });
  const normalizeRow = (row: string[]) =>
    Array.from({ length: cols }, (_, i) => row[i] ?? "");

  const setHeader = (c: number, v: string) => {
    const next = normalizeRow(headers);
    next[c] = v;
    patch({ headers: next });
  };
  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map(normalizeRow);
    next[r][c] = v;
    patch({ rows: next });
  };
  const addColumn = () =>
    patch({
      headers: [...normalizeRow(headers), `Column ${cols + 1}`],
      rows: rows.map((row) => [...normalizeRow(row), ""]),
    });
  const removeColumn = (c: number) =>
    patch({
      headers: normalizeRow(headers).filter((_, i) => i !== c),
      rows: rows.map((row) => normalizeRow(row).filter((_, i) => i !== c)),
    });
  const addRow = () => patch({ rows: [...rows, Array.from({ length: cols }, () => "")] });
  const removeRow = (r: number) => patch({ rows: rows.filter((_, i) => i !== r) });

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

      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="p-1">
                  <div className="flex flex-col gap-1">
                    <input
                      className={`${inputCls} w-28 font-semibold`}
                      placeholder={`Header ${c + 1}`}
                      value={headers[c] ?? ""}
                      onChange={(e) => setHeader(c, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(c)}
                      className="text-xs text-muted hover:text-red-400"
                    >
                      ✕ col
                    </button>
                  </div>
                </th>
              ))}
              <th className="p-1 align-top">
                <button
                  type="button"
                  onClick={addColumn}
                  className="rounded border border-dashed border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  ＋ col
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="p-1">
                    <input
                      className={`${inputCls} w-28`}
                      value={row[c] ?? ""}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <button
                    type="button"
                    onClick={() => removeRow(r)}
                    className="text-xs text-muted hover:text-red-400"
                  >
                    ✕ row
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
      >
        ＋ row
      </button>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={striped}
          onChange={(e) => patch({ striped: e.target.checked })}
        />
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          striped rows
        </span>
      </label>
    </div>
  );
}

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

/** SchemaForm over everything except `except` — mix generated + custom parts. */
function omitProps(schema: JsonSchema, except: string[]): JsonSchema {
  const properties = { ...((schema.properties as Record<string, unknown>) ?? {}) };
  for (const key of except) delete properties[key];
  return { ...schema, properties };
}

function Mini2({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-line px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}

type ImageRow = { src: string; alt?: string; caption?: string };

/** Row editor for image lists (gallery/carousel): src/alt/caption + ordering. */
function ImagesEditor({ config, onChange, schema }: WidgetEditorProps) {
  const images = (Array.isArray(config.images) ? config.images : []) as ImageRow[];
  const set = (next: ImageRow[]) => onChange({ ...config, images: next });
  const update = (i: number, patch: Partial<ImageRow>) =>
    set(images.map((img, idx) => (idx === i ? { ...img, ...patch } : img)));
  const move = (i: number, d: -1 | 1) => {
    const to = i + d;
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    [next[i], next[to]] = [next[to], next[i]];
    set(next);
  };

  return (
    <div className="space-y-3">
      <SchemaForm schema={omitProps(schema, ["images"])} value={config} onChange={onChange} />
      <div>
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          photos
        </span>
        <div className="mt-1 space-y-2">
          {images.map((img, i) => (
            <div key={i} className="rounded-lg border border-line p-2">
              <input
                className={`${inputCls} w-full`}
                placeholder="/boards/foo.png of https://…"
                value={img.src}
                onChange={(e) => update(i, { src: e.target.value })}
              />
              <div className="mt-1.5 flex gap-1.5">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="alt"
                  value={img.alt ?? ""}
                  onChange={(e) => update(i, { alt: e.target.value })}
                />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="caption"
                  value={img.caption ?? ""}
                  onChange={(e) => update(i, { caption: e.target.value })}
                />
                <Mini2 label="↑" onClick={() => move(i, -1)} />
                <Mini2 label="↓" onClick={() => move(i, 1)} />
                <Mini2 label="✕" onClick={() => set(images.filter((_, idx) => idx !== i))} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set([...images, { src: "" }])}
            className="rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            ＋ photo
          </button>
        </div>
      </div>
    </div>
  );
}

type MarkerRow = { lat: number; lng: number; label?: string; markdown?: string };

/** Row editor for map markers: lat/lng/label + popup markdown. */
function MapEditor({ config, onChange, schema }: WidgetEditorProps) {
  const markers = (Array.isArray(config.markers) ? config.markers : []) as MarkerRow[];
  const set = (next: MarkerRow[]) => onChange({ ...config, markers: next });
  const update = (i: number, patch: Partial<MarkerRow>) =>
    set(markers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const num = (v: string) => (v === "" || Number.isNaN(Number(v)) ? 0 : Number(v));

  return (
    <div className="space-y-3">
      <SchemaForm schema={omitProps(schema, ["markers"])} value={config} onChange={onChange} />
      <div>
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          markers
        </span>
        <div className="mt-1 space-y-2">
          {markers.map((m, i) => (
            <div key={i} className="rounded-lg border border-line p-2">
              <div className="flex gap-1.5">
                <input
                  className={`${inputCls} w-24`}
                  placeholder="lat"
                  value={String(m.lat)}
                  onChange={(e) => update(i, { lat: num(e.target.value) })}
                />
                <input
                  className={`${inputCls} w-24`}
                  placeholder="lng"
                  value={String(m.lng)}
                  onChange={(e) => update(i, { lng: num(e.target.value) })}
                />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="label"
                  value={m.label ?? ""}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
                <Mini2 label="✕" onClick={() => set(markers.filter((_, idx) => idx !== i))} />
              </div>
              <textarea
                className={`${inputCls} mt-1.5 w-full`}
                rows={2}
                placeholder="popup (markdown, optioneel)"
                value={m.markdown ?? ""}
                onChange={(e) => update(i, { markdown: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => set([...markers, { lat: 52.37, lng: 4.9 }])}
            className="rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            ＋ marker
          </button>
        </div>
      </div>
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
  table: TableEditor,
  board: BoardEditor,
  gallery: ImagesEditor,
  carousel: ImagesEditor,
  map: MapEditor,
  kanban: KanbanEditor,
};

export function WidgetEditorFor({ type, ...props }: WidgetEditorProps & { type: string }) {
  const Custom = widgetEditors[type];
  if (Custom) return <Custom {...props} />;
  return <SchemaForm schema={props.schema} value={props.config} onChange={props.onChange} />;
}
