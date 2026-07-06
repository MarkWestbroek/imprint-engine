"use client";

import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "./schema-form";

/**
 * Visual page composer (Pleio-style): the page is rows of cells ("vakken");
 * "+" buttons add cells left/right and rows above/below, widgets stack
 * inside cells and move with arrows. Not to-the-millimetre WYSIWYG — the
 * canvas mirrors the real proportions, the site applies the actual styling.
 */

type WidgetV = { type: string; config: Record<string, unknown> };
type CellV = { span: number; widgets: WidgetV[] };
type RowV = { cells: CellV[] };
export type LayoutValue = { rows: RowV[] };

const MAX_CELLS = 4;
const MAX_SPAN = 4;

export function PageComposer({
  value,
  onChange,
  presets,
  widgetSchemas,
}: {
  value: LayoutValue | undefined;
  onChange: (v: LayoutValue | undefined) => void;
  presets: { label: string; rows: RowV[] }[];
  widgetSchemas: { name: string; label: string; schema: JsonSchema }[];
}) {
  if (!value || value.rows.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Start from:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent"
            onClick={() =>
              onChange({ rows: structuredClone(p.rows) as RowV[] })
            }
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  const rows = value.rows;
  const setRows = (next: RowV[]) =>
    onChange(next.length === 0 ? undefined : { rows: next });

  const insertRow = (at: number) => {
    const next = [...rows];
    next.splice(at, 0, { cells: [{ span: 1, widgets: [] }] });
    setRows(next);
  };

  const deleteRow = (r: number) => {
    const next = [...rows];
    const [removed] = next.splice(r, 1);
    const strays = removed.cells.flatMap((c) => c.widgets);
    if (strays.length > 0) {
      // Don't lose widgets: tuck them into the nearest remaining cell.
      const target = next[Math.max(0, r - 1)]?.cells[0];
      if (target) target.widgets = [...target.widgets, ...strays];
      else next.push({ cells: [{ span: 1, widgets: strays }] });
    }
    setRows(next);
  };

  const insertCell = (r: number, at: number) => {
    if (rows[r].cells.length >= MAX_CELLS) return;
    const next = structuredClone(rows) as RowV[];
    next[r].cells.splice(at, 0, { span: 1, widgets: [] });
    setRows(next);
  };

  const deleteCell = (r: number, c: number) => {
    const next = structuredClone(rows) as RowV[];
    const [removed] = next[r].cells.splice(c, 1);
    if (next[r].cells.length === 0) {
      setRows(rows); // shouldn't happen (button hidden); keep state sane
      deleteRow(r);
      return;
    }
    const neighbour = next[r].cells[Math.max(0, c - 1)];
    neighbour.widgets = [...neighbour.widgets, ...removed.widgets];
    setRows(next);
  };

  const resizeCell = (r: number, c: number, delta: 1 | -1) => {
    const next = structuredClone(rows) as RowV[];
    const cell = next[r].cells[c];
    cell.span = Math.min(MAX_SPAN, Math.max(1, cell.span + delta));
    setRows(next);
  };

  const updateWidget = (r: number, c: number, w: number, widget: WidgetV) => {
    const next = structuredClone(rows) as RowV[];
    next[r].cells[c].widgets[w] = widget;
    setRows(next);
  };

  const deleteWidget = (r: number, c: number, w: number) => {
    const next = structuredClone(rows) as RowV[];
    next[r].cells[c].widgets.splice(w, 1);
    setRows(next);
  };

  const moveWidget = (
    r: number,
    c: number,
    w: number,
    move: "up" | "down" | "left" | "right"
  ) => {
    const next = structuredClone(rows) as RowV[];
    const widgets = next[r].cells[c].widgets;
    if (move === "up" || move === "down") {
      const to = move === "up" ? w - 1 : w + 1;
      if (to < 0 || to >= widgets.length) return;
      [widgets[w], widgets[to]] = [widgets[to], widgets[w]];
    } else {
      const to = move === "left" ? c - 1 : c + 1;
      if (to < 0 || to >= next[r].cells.length) return;
      const [widget] = widgets.splice(w, 1);
      next[r].cells[to].widgets.push(widget);
    }
    setRows(next);
  };

  const addWidget = (r: number, c: number, type: string) => {
    const next = structuredClone(rows) as RowV[];
    next[r].cells[c].widgets.push({ type, config: {} });
    setRows(next);
  };

  return (
    <div>
      <InsertRowBar onClick={() => insertRow(0)} />
      {rows.map((row, r) => (
        <div key={r}>
          <div className="flex items-stretch gap-1.5">
            <EdgeButton
              title="Add box left"
              disabled={row.cells.length >= MAX_CELLS}
              onClick={() => insertCell(r, 0)}
            />
            <div
              className="grid min-w-0 flex-1 items-start gap-3 [grid-template-columns:var(--cols)]"
              style={{
                ["--cols" as string]: row.cells
                  .map((cell) => `minmax(0,${cell.span}fr)`)
                  .join(" "),
              }}
            >
              {row.cells.map((cell, c) => (
                <div key={c} className="rounded-xl border border-dashed border-line p-2.5">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted">
                    <span className="flex items-center gap-1">
                      width
                      <MiniButton label="−" onClick={() => resizeCell(r, c, -1)} />
                      <span className="w-3 text-center text-foreground">{cell.span}</span>
                      <MiniButton label="+" onClick={() => resizeCell(r, c, 1)} />
                    </span>
                    {row.cells.length > 1 && (
                      <MiniButton
                        label="✕ box"
                        title="Remove box (widgets move to the neighbour)"
                        onClick={() => deleteCell(r, c)}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    {cell.widgets.map((widget, w) => {
                      const def = widgetSchemas.find((d) => d.name === widget.type);
                      return (
                        <details
                          key={`${widget.type}-${w}`}
                          className="rounded-lg border border-line bg-background"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2">
                            <span className="text-sm font-medium">
                              {def?.label ?? widget.type}
                            </span>
                            <span className="flex gap-1 text-xs">
                              <MiniButton label="↑" onClick={() => moveWidget(r, c, w, "up")} />
                              <MiniButton label="↓" onClick={() => moveWidget(r, c, w, "down")} />
                              <MiniButton label="◀" onClick={() => moveWidget(r, c, w, "left")} />
                              <MiniButton label="▶" onClick={() => moveWidget(r, c, w, "right")} />
                              <MiniButton label="✕" onClick={() => deleteWidget(r, c, w)} />
                            </span>
                          </summary>
                          <div className="border-t border-line px-2.5 py-2">
                            {def && (
                              <SchemaForm
                                schema={def.schema}
                                value={widget.config}
                                onChange={(config) =>
                                  updateWidget(r, c, w, { ...widget, config })
                                }
                              />
                            )}
                          </div>
                        </details>
                      );
                    })}
                    <select
                      className="w-full rounded-md border border-dashed border-line bg-background px-2 py-1.5 text-xs text-muted"
                      value=""
                      onChange={(e) => e.target.value && addWidget(r, c, e.target.value)}
                    >
                      <option value="">+ widget…</option>
                      {widgetSchemas.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <EdgeButton
              title="Add box right"
              disabled={row.cells.length >= MAX_CELLS}
              onClick={() => insertCell(r, row.cells.length)}
            />
            <div className="flex flex-col justify-center">
              <MiniButton label="✕" title="Remove row" onClick={() => deleteRow(r)} />
            </div>
          </div>
          <InsertRowBar onClick={() => insertRow(r + 1)} />
        </div>
      ))}
    </div>
  );
}

/** Slim horizontal "+" bar between rows (add a row above/below). */
function InsertRowBar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Add row here"
      onClick={onClick}
      className="group my-1 flex w-full items-center gap-2 py-1 text-xs text-muted/50 hover:text-accent"
    >
      <span className="h-px flex-1 bg-line group-hover:bg-accent" />
      +
      <span className="h-px flex-1 bg-line group-hover:bg-accent" />
    </button>
  );
}

/** Slim vertical "+" strip at a row edge (add a box left/right). */
function EdgeButton({
  title,
  disabled,
  onClick,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="w-5 rounded-md border border-dashed border-line text-xs text-muted/60 hover:border-accent hover:text-accent disabled:opacity-30"
    >
      +
    </button>
  );
}

function MiniButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault(); // keep <details> from toggling on toolbar clicks
        onClick();
      }}
      className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}
