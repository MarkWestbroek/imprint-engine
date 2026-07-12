import type { LayoutRow } from "@imprint/content-core";

/**
 * Pure mutations on a page draft (meta + body + rows), used by the studio's
 * server actions. Kept free of React so it's easy to reason about and test.
 */

export type PageDraft = {
  /** Page meta (slug, title, description, draft, publishedAt, lang, …). */
  meta: Record<string, unknown>;
  body: string;
  rows: LayoutRow[];
};

export type WidgetPath = { r: number; c: number; w: number };

export type DraftOp =
  | { kind: "meta"; patch: Record<string, unknown> }
  | { kind: "body"; body: string }
  | { kind: "widget-config"; path: WidgetPath; config: unknown }
  | { kind: "widget-add"; r: number; c: number; type: string }
  | { kind: "widget-move"; path: WidgetPath; dir: "up" | "down" | "left" | "right" }
  | { kind: "widget-delete"; path: WidgetPath }
  | { kind: "row-add"; at: number }
  | { kind: "row-delete"; r: number }
  | { kind: "cell-add"; r: number; at: number }
  | { kind: "cell-delete"; r: number; c: number }
  | { kind: "cell-resize"; r: number; c: number; delta: 1 | -1 };

export const MAX_CELLS = 4;
export const MAX_SPAN = 4;

/** Apply one op; returns a new draft (input is not mutated). */
export function applyOp(draft: PageDraft, op: DraftOp): PageDraft {
  const next: PageDraft = structuredClone(draft);
  const rows = next.rows;

  switch (op.kind) {
    case "meta":
      next.meta = { ...next.meta, ...op.patch };
      break;

    case "body":
      next.body = op.body;
      break;

    case "widget-config": {
      const widget = rows[op.path.r]?.cells[op.path.c]?.widgets[op.path.w];
      if (widget) widget.config = op.config;
      break;
    }

    case "widget-add": {
      rows[op.r]?.cells[op.c]?.widgets.push({ type: op.type, config: {} });
      break;
    }

    case "widget-move": {
      const { r, c, w } = op.path;
      const cell = rows[r]?.cells[c];
      if (!cell) break;
      if (op.dir === "up" || op.dir === "down") {
        const to = op.dir === "up" ? w - 1 : w + 1;
        if (to < 0 || to >= cell.widgets.length) break;
        [cell.widgets[w], cell.widgets[to]] = [cell.widgets[to], cell.widgets[w]];
      } else {
        const to = op.dir === "left" ? c - 1 : c + 1;
        const target = rows[r]?.cells[to];
        if (!target) break;
        const [widget] = cell.widgets.splice(w, 1);
        target.widgets.push(widget);
      }
      break;
    }

    case "widget-delete": {
      rows[op.path.r]?.cells[op.path.c]?.widgets.splice(op.path.w, 1);
      break;
    }

    case "row-add":
      rows.splice(op.at, 0, { cells: [{ span: 1, widgets: [] }] });
      break;

    case "row-delete": {
      const [removed] = rows.splice(op.r, 1);
      if (!removed) break;
      // Don't lose widgets: tuck them into the nearest remaining cell.
      const strays = removed.cells.flatMap((cell) => cell.widgets);
      if (strays.length > 0) {
        const target = rows[Math.max(0, op.r - 1)]?.cells[0];
        if (target) target.widgets.push(...strays);
        else rows.push({ cells: [{ span: 1, widgets: strays }] });
      }
      break;
    }

    case "cell-add": {
      const row = rows[op.r];
      if (!row || row.cells.length >= MAX_CELLS) break;
      row.cells.splice(op.at, 0, { span: 1, widgets: [] });
      break;
    }

    case "cell-delete": {
      const row = rows[op.r];
      if (!row) break;
      if (row.cells.length === 1) return applyOp(draft, { kind: "row-delete", r: op.r });
      const [removed] = row.cells.splice(op.c, 1);
      row.cells[Math.max(0, op.c - 1)].widgets.push(...removed.widgets);
      break;
    }

    case "cell-resize": {
      const cell = rows[op.r]?.cells[op.c];
      if (!cell) break;
      cell.span = Math.min(MAX_SPAN, Math.max(1, cell.span + op.delta));
      break;
    }
  }
  return next;
}
