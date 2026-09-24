"use client";

import { useState } from "react";
import type { JsonSchema } from "@imprint/runtime-admin/forms";
import { SchemaForm, type WidgetEditor, type WidgetEditorProps } from "@imprint/runtime-admin/admin";

/**
 * Editors for the standard widgets that deserve more than the generated form
 * (Fase 4, step 4): the table grid, the image-list editor of gallery and
 * carousel, and the marker editor of the map. A site spreads
 * `standardEditors` into its own widget-editor map and adds editors for its
 * domain widgets; the small helpers are exported for those.
 */

export const editorInputCls =
  "rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";
const inputCls = editorInputCls;

/** Grid editor for the table widget: edit headers/cells, add/remove rows & columns. */
export function TableEditor({ config, onChange }: WidgetEditorProps) {
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

/** SchemaForm over everything except `except` — mix generated + custom parts. */
export function omitProps(schema: JsonSchema, except: string[]): JsonSchema {
  const properties = { ...((schema.properties as Record<string, unknown>) ?? {}) };
  for (const key of except) delete properties[key];
  return { ...schema, properties };
}

export function Mini2({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
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
export function ImagesEditor({ config, onChange, schema }: WidgetEditorProps) {
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

/**
 * Number input that lets you *type* decimals: the raw text lives in local
 * state (so "52." survives the keystroke) and only parseable values are
 * committed. A parsed-per-keystroke controlled input eats the dot. Accepts
 * a comma as decimal separator too.
 */
export function NumInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: number;
  onCommit: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Reset when the value changed externally (row moved/added) — the sanctioned
  // "adjust state during render" pattern, so typing "52." isn't clobbered.
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <input
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t.replace(",", "."));
        if (t.trim() !== "" && !Number.isNaN(n)) onCommit(n);
      }}
    />
  );
}

/** Row editor for map markers: lat/lng/label + popup markdown. */
export function MapEditor({ config, onChange, schema }: WidgetEditorProps) {
  const markers = (Array.isArray(config.markers) ? config.markers : []) as MarkerRow[];
  const set = (next: MarkerRow[]) => onChange({ ...config, markers: next });
  const update = (i: number, patch: Partial<MarkerRow>) =>
    set(markers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

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
                <NumInput
                  className={`${inputCls} w-24`}
                  placeholder="lat"
                  value={m.lat}
                  onCommit={(lat) => update(i, { lat })}
                />
                <NumInput
                  className={`${inputCls} w-24`}
                  placeholder="lng"
                  value={m.lng}
                  onCommit={(lng) => update(i, { lng })}
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



export const standardEditors: Record<string, WidgetEditor> = {
  table: TableEditor,
  gallery: ImagesEditor,
  carousel: ImagesEditor,
  map: MapEditor,
};
