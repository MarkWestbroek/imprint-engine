"use client";

import { useEffect, useMemo, useState } from "react";
import type { JsonSchema } from "@imprint/runtime-admin/forms";
import { AssetField, SchemaForm, type WidgetEditor, type WidgetEditorProps } from "@imprint/runtime-admin/admin";
import { omniumViewsAction } from "./omnium-actions";
import { viewsOfModel } from "./omnium";

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
              <AssetField label={`photo ${i + 1}`} value={img.src} onChange={(src) => update(i, { src: src ?? "" })} />
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



type V3Source = "omnium" | "code" | "url";
type Views = { diagrammen: string[]; domeinen: string[]; versie?: string; tijdstip?: string };

const labelCls = "block text-xs font-medium uppercase tracking-wide text-muted";
const str = (v: unknown) => (typeof v === "string" ? v : "");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Pick list of what Omnium can draw for the model: the views of an Omnium model, or of pasted code. */
function useV3Views(source: V3Source, config: Record<string, unknown>): { views: Views | null; error?: string; loading: boolean } {
  const naam = str(config.model).trim();
  const versie = str(config.versie).trim();
  const asOf = str(config.asOf).trim();
  const json = str(config.json);
  const [remote, setRemote] = useState<{ key: string; views: Views | null; error?: string } | null>(null);
  const key = `${naam}\n${versie}\n${asOf}`;

  useEffect(() => {
    if (source !== "omnium" || !naam) return;
    let live = true;
    // Debounced: the name is typed letter by letter.
    const t = setTimeout(() => {
      omniumViewsAction(naam, versie, asOf).then(
        (r) => live && setRemote("error" in r ? { key, views: null, error: r.error } : { key, views: r }),
        (e) => live && setRemote({ key, views: null, error: String(e) })
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [source, naam, versie, asOf, key]);

  const local = useMemo(() => {
    if (source !== "code" || !json.trim()) return null;
    try {
      return viewsOfModel(JSON.parse(json));
    } catch {
      return null;
    }
  }, [source, json]);

  if (source === "code") return { views: local, loading: false };
  if (source === "omnium" && naam) {
    if (remote?.key !== key) return { views: null, loading: true };
    return { views: remote.views, error: remote.error, loading: false };
  }
  return { views: null, loading: false };
}

/**
 * Editor for the v3model widget: first *which model* (a model in Omnium, pasted
 * code or a URL; only that source's fields show), then *which part* from a pick
 * list of the model's diagrams and domains, then colours; the fine-tuning sits
 * under "More". Replaces the generated form of fifteen flat fields.
 */
export function V3ModelEditor({ config, onChange }: WidgetEditorProps) {
  const initial: V3Source = str(config.model) ? "omnium" : str(config.json) ? "code" : str(config.url) ? "url" : "omnium";
  const [source, setSource] = useState<V3Source>(initial);
  const { views, error, loading } = useV3Views(source, config);

  /** Merge and drop empty values, so the stored config stays small. */
  const patch = (next: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...config, ...next };
    for (const [k, v] of Object.entries(merged)) if (v === undefined || v === "") delete merged[k];
    onChange(merged);
  };
  const pickSource = (s: V3Source) => {
    setSource(s);
    // One source at a time: the viewer would otherwise silently prefer model > json > url.
    patch({
      model: s === "omnium" ? config.model : undefined,
      versie: s === "omnium" ? config.versie : undefined,
      asOf: s === "omnium" ? config.asOf : undefined,
      json: s === "code" ? config.json : undefined,
      url: s === "url" ? config.url : undefined,
    });
  };

  const diagram = str(config.diagram);
  const domein = str(config.domein);
  const viewValue = diagram ? `diagram:${diagram}` : domein ? `domein:${domein}` : "";
  const setView = (v: string) => {
    const [kind, ...rest] = v.split(":");
    const name = rest.join(":");
    patch({ diagram: kind === "diagram" ? name : undefined, domein: kind === "domein" ? name : undefined });
  };
  const wholeModelOk = views ? views.diagrammen.length === 0 && views.domeinen.length <= 1 : false;
  // Keep a stored choice visible even when the list does not (or no longer) offer it.
  const stale = viewValue && views && !(diagram ? views.diagrammen.includes(diagram) : views.domeinen.includes(domein));

  const showFields = config.showFields !== false;
  const kleuren = config.kleuren === "site" ? "site" : "licht";

  return (
    <div className="space-y-3">
      <Field label="Titel">
        <input className={`w-full ${inputCls}`} value={str(config.title)} onChange={(e) => patch({ title: e.target.value })} />
      </Field>

      <div>
        <span className={labelCls}>Welk model</span>
        <div className="mt-1 flex overflow-hidden rounded-md border border-line text-sm">
          {(
            [
              ["omnium", "Model in Omnium"],
              ["code", "Code plakken"],
              ["url", "Van URL"],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => pickSource(s)}
              className={`flex-1 px-2 py-1 ${source === s ? "bg-accent text-background" : "text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {source === "omnium" && (
        <div className="space-y-3 rounded-lg border border-line p-2">
          <Field label="Modelnaam" hint="Zoals het model in Omnium heet, bv. np-loc + register.">
            <input className={`w-full ${inputCls}`} value={str(config.model)} onChange={(e) => patch({ model: e.target.value })} />
          </Field>
          <Field label="Versie" hint="Leeg = steeds de nieuwste. Zet hem vast, dan blijft de pagina gelijk.">
            <div className="flex gap-1.5">
              <input className={`flex-1 ${inputCls}`} value={str(config.versie)} onChange={(e) => patch({ versie: e.target.value })} />
              {!str(config.versie) && views?.versie && (
                <Mini2 label={`vastzetten op ${views.versie}`} title="Deze versie in de widget vastleggen" onClick={() => patch({ versie: views.versie })} />
              )}
            </div>
          </Field>
          <Field label="Zoals op (optioneel)" hint="Het model zoals het op dit moment was, bv. 2026-09-01T00:00:00Z.">
            <input className={`w-full ${inputCls}`} value={str(config.asOf)} onChange={(e) => patch({ asOf: e.target.value })} />
          </Field>
        </div>
      )}
      {source === "code" && (
        <Field label="Modelcode (V3-JSON)">
          <textarea className={`w-full font-mono ${inputCls}`} rows={8} value={str(config.json)} onChange={(e) => patch({ json: e.target.value })} />
        </Field>
      )}
      {source === "url" && (
        <Field label="URL van de modelcode" hint="Bv. https://musicbrain.nl/api/meta?format=v3">
          <input className={`w-full ${inputCls}`} value={str(config.url)} onChange={(e) => patch({ url: e.target.value })} />
        </Field>
      )}

      <Field
        label="Wat tonen"
        hint={
          loading
            ? "Keuzes ophalen bij Omnium…"
            : error
              ? error
              : views
                ? views.diagrammen.length > 0
                  ? "Een opgeslagen diagram is de beste keus; anders één domein."
                  : "Dit model heeft geen opgeslagen diagrammen: kies een domein."
                : undefined
        }
      >
        {views ? (
          <select className={`w-full ${inputCls}`} value={viewValue} onChange={(e) => setView(e.target.value)}>
            <option value="">{wholeModelOk ? "Het hele model" : "— kies —"}</option>
            {stale && <option value={viewValue}>{diagram || domein} (niet gevonden)</option>}
            {views.diagrammen.length > 0 && (
              <optgroup label="Diagrammen">
                {views.diagrammen.map((d) => (
                  <option key={d} value={`diagram:${d}`}>{d}</option>
                ))}
              </optgroup>
            )}
            {views.domeinen.length > 0 && (
              <optgroup label="Domeinen">
                {views.domeinen.map((d) => (
                  <option key={d} value={`domein:${d}`}>{d}</option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <div className="flex gap-1.5">
            <input className={`flex-1 ${inputCls}`} placeholder="diagram" value={diagram} onChange={(e) => patch({ diagram: e.target.value, domein: undefined })} />
            <input className={`flex-1 ${inputCls}`} placeholder="of domein" value={domein} onChange={(e) => patch({ domein: e.target.value, diagram: undefined })} />
          </div>
        )}
      </Field>

      <div>
        <span className={labelCls}>Kleuren</span>
        <div className="mt-1 flex gap-4 text-sm">
          {(
            [
              ["licht", "Licht (als figuur)"],
              ["site", "Kleuren van de site"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="radio" checked={kleuren === k} onChange={() => patch({ kleuren: k === "licht" ? undefined : k })} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Field label="Onderschrift">
        <input className={`w-full ${inputCls}`} value={str(config.caption)} onChange={(e) => patch({ caption: e.target.value })} />
      </Field>

      <details className="rounded-lg border border-line p-2">
        <summary className="cursor-pointer text-sm text-muted">Meer</summary>
        <div className="mt-2 space-y-3">
          <Field label="Alleen deze entiteiten" hint="Komma-gescheiden, binnen het gekozen diagram of domein.">
            <input className={`w-full ${inputCls}`} value={str(config.entiteiten)} onChange={(e) => patch({ entiteiten: e.target.value })} />
          </Field>
          <Field label="Richting">
            <select
              className={`w-full ${inputCls}`}
              value={str(config.richting)}
              onChange={(e) => patch({ richting: e.target.value || undefined })}
            >
              <option value="">Boven → onder (standaard)</option>
              <option value="LR">Links → rechts</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showFields} onChange={(e) => patch({ showFields: e.target.checked ? undefined : false })} />
            Velden in de kaarten tonen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.afhankelijkheden === true} onChange={(e) => patch({ afhankelijkheden: e.target.checked || undefined })} />
            Datatypes en «use»-lijnen tonen
          </label>
          <Field label="Maximale breedte (px)" hint="Leeg = de volle breedte van het vak.">
            <input
              type="number"
              min={1}
              className={`w-32 ${inputCls}`}
              value={typeof config.maxWidth === "number" ? config.maxWidth : ""}
              onChange={(e) => patch({ maxWidth: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined })}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

export const standardEditors: Record<string, WidgetEditor> = {
  table: TableEditor,
  gallery: ImagesEditor,
  carousel: ImagesEditor,
  map: MapEditor,
  v3model: V3ModelEditor,
};
