"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LayoutRow } from "@imprint/content-core";
import {
  draftOpAction,
  resetDraftAction,
  savePageDraftAction,
} from "@/app/admin/studio-actions";
import type { DraftOp, WidgetPath } from "@/lib/layout-ops";
import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "./schema-form";
import { WidgetEditorFor } from "@/widgets/editors";

/**
 * Client half of the page studio. The canvas itself is server-rendered
 * (real widget viewers, real data, real site chrome); these components add
 * the editing skin on top: selection outlines, toolbars, "+" affordances
 * and the sidebar that edits one widget (or the page settings) at a time.
 * Every mutation goes to the server-side draft, then router.refresh()
 * re-renders the canvas — that's what makes changes visible immediately.
 */

type WidgetSchemaDef = { name: string; label: string; schema: JsonSchema };

type StudioCtx = {
  slug?: string;
  lang: string;
  meta: Record<string, unknown>;
  body: string;
  rows: LayoutRow[];
  metaSchema: JsonSchema;
  widgetSchemas: WidgetSchemaDef[];
  sel: WidgetPath | null;
  setSel: (sel: WidgetPath | null) => void;
  dispatch: (op: DraftOp, after?: () => void) => void;
  pending: boolean;
};

const Ctx = createContext<StudioCtx | null>(null);
function useStudio(): StudioCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Studio components must live inside <StudioProvider>");
  return ctx;
}

export function StudioProvider({
  slug,
  lang,
  meta,
  body,
  rows,
  metaSchema,
  widgetSchemas,
  children,
}: {
  slug?: string;
  lang: string;
  meta: Record<string, unknown>;
  body: string;
  rows: LayoutRow[];
  metaSchema: JsonSchema;
  widgetSchemas: WidgetSchemaDef[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<WidgetPath | null>(null);
  const [isPending, startTransition] = useTransition();

  const dispatch = (op: DraftOp, after?: () => void) => {
    startTransition(async () => {
      await draftOpAction(slug, lang, op);
      after?.();
      router.refresh();
    });
  };

  return (
    <Ctx.Provider
      value={{
        slug,
        lang,
        meta,
        body,
        rows,
        metaSchema,
        widgetSchemas,
        sel,
        setSel,
        dispatch,
        pending: isPending,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/* ---------- top bar ---------- */

export function StudioTopBar({ isNew }: { isNew: boolean }) {
  const { slug, lang, meta, pending } = useStudio();
  const router = useRouter();
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await savePageDraftAction(slug, lang, { validFrom, validTo });
      if (result.ok && result.slug) {
        setMessage({ ok: true, text: "Saved ✓" });
        if (result.slug !== slug) {
          router.replace(`/admin/page/edit/${result.slug}?lang=${lang}`);
        }
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error ?? "Save failed" });
      }
    });

  const reset = () =>
    startTransition(async () => {
      await resetDraftAction(slug, lang);
      setMessage(null);
      router.refresh();
    });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
      <Link href="/admin/page" className="text-sm text-muted hover:text-foreground">
        ← Pages
      </Link>
      <span className="text-sm font-semibold">
        {isNew ? "New page" : `/${String(meta.slug ?? "")}`}
      </span>
      {(pending || busy) && <span className="text-xs text-muted">syncing…</span>}
      {message && (
        <span className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs text-muted">
        <label>
          valid from{" "}
          <input
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="rounded border border-line bg-background px-1.5 py-1"
          />
        </label>
        <label>
          to{" "}
          <input
            type="datetime-local"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            className="rounded border border-line bg-background px-1.5 py-1"
          />
        </label>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-foreground hover:border-accent"
        >
          Undo changes
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
        >
          {isNew ? "Create page" : "Save new version"}
        </button>
      </span>
    </div>
  );
}

/* ---------- sidebar ---------- */

export function StudioSidebar() {
  const { sel, rows, widgetSchemas } = useStudio();
  const widget = sel ? rows[sel.r]?.cells[sel.c]?.widgets[sel.w] : undefined;

  return (
    <aside className="w-80 shrink-0 self-start rounded-xl border border-line bg-surface p-4">
      {sel && widget ? (
        <WidgetPane
          key={`${sel.r}-${sel.c}-${sel.w}-${widget.type}`}
          path={sel}
          type={widget.type}
          config={(widget.config ?? {}) as Record<string, unknown>}
          def={widgetSchemas.find((d) => d.name === widget.type)}
        />
      ) : (
        <PageSettingsPane />
      )}
    </aside>
  );
}

/** Edits one widget's config; changes flow to the draft (debounced). */
function WidgetPane({
  path,
  type,
  config,
  def,
}: {
  path: WidgetPath;
  type: string;
  config: Record<string, unknown>;
  def?: { label: string; schema: JsonSchema };
}) {
  const { dispatch, setSel } = useStudio();
  const [local, setLocal] = useState(config);
  useDebouncedOp(local, config, (value) => ({
    kind: "widget-config",
    path,
    config: value,
  }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{def?.label ?? type}</h2>
        <button
          type="button"
          onClick={() => setSel(null)}
          className="text-xs text-muted hover:text-foreground"
        >
          ✓ Done
        </button>
      </div>
      {def && (
        <WidgetEditorFor
          type={type}
          schema={def.schema}
          config={local}
          onChange={setLocal}
        />
      )}
      <div className="mt-4 flex gap-2 border-t border-line pt-3 text-xs">
        <Mini label="↑" title="Move up" onClick={() => moveSel(dispatch, setSel, path, "up")} />
        <Mini label="↓" title="Move down" onClick={() => moveSel(dispatch, setSel, path, "down")} />
        <Mini label="◀" title="Move to box left" onClick={() => moveSel(dispatch, setSel, path, "left")} />
        <Mini label="▶" title="Move to box right" onClick={() => moveSel(dispatch, setSel, path, "right")} />
        <Mini
          label="✕ delete"
          onClick={() => {
            setSel(null);
            dispatch({ kind: "widget-delete", path });
          }}
        />
      </div>
    </div>
  );
}

function moveSel(
  dispatch: StudioCtx["dispatch"],
  setSel: StudioCtx["setSel"],
  path: WidgetPath,
  dir: "up" | "down" | "left" | "right"
) {
  dispatch({ kind: "widget-move", path, dir });
  // Follow the widget so the sidebar stays attached to it.
  if (dir === "up") setSel({ ...path, w: Math.max(0, path.w - 1) });
  if (dir === "down") setSel({ ...path, w: path.w + 1 });
  if (dir === "left") setSel(null);
  if (dir === "right") setSel(null);
}

/** Page settings (meta + markdown body) when no widget is selected. */
function PageSettingsPane() {
  const { meta, body, metaSchema } = useStudio();
  const [localMeta, setLocalMeta] = useState(meta);
  const [localBody, setLocalBody] = useState(body);
  useDebouncedOp(localMeta, meta, (value) => ({ kind: "meta", patch: value }));
  useDebouncedOp(localBody, body, (value) => ({ kind: "body", body: value }));

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Page settings</h2>
      <p className="mb-3 text-xs text-muted">
        Click a widget in the canvas to edit it; its settings appear here.
      </p>
      <SchemaForm schema={metaSchema} value={localMeta} onChange={setLocalMeta} />
      <label className="mt-3 block">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          body (markdown, above the widgets)
        </span>
        <textarea
          className="mt-1 min-h-32 w-full rounded-md border border-line bg-background px-2.5 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
          value={localBody}
          onChange={(e) => setLocalBody(e.target.value)}
        />
      </label>
    </div>
  );
}

/** Push local edits to the server draft ~350ms after the last keystroke. */
function useDebouncedOp<T>(local: T, server: T, toOp: (value: T) => DraftOp) {
  const { dispatch } = useStudio();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (JSON.stringify(local) === JSON.stringify(server)) return;
    const timer = setTimeout(() => dispatch(toOp(local)), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
}

/* ---------- canvas chrome ---------- */

/** Clickable frame around one server-rendered widget preview. */
export function WidgetShell({
  path,
  label,
  children,
}: {
  path: WidgetPath;
  label: string;
  children: React.ReactNode;
}) {
  const { sel, setSel } = useStudio();
  const selected = sel?.r === path.r && sel?.c === path.c && sel?.w === path.w;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setSel(path);
      }}
      className={`relative cursor-pointer rounded-xl outline-offset-2 transition ${
        selected ? "outline-2 outline-accent" : "hover:outline-2 hover:outline-line"
      }`}
      title={`Edit ${label}`}
    >
      {selected && (
        <span className="absolute -top-2.5 left-3 z-10 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-background">
          {label}
        </span>
      )}
      {/* Previews are real widgets; keep their links from navigating. */}
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

export function CellChrome({
  r,
  c,
  span,
  canDelete,
  children,
}: {
  r: number;
  c: number;
  span: number;
  canDelete: boolean;
  children: React.ReactNode;
}) {
  const { dispatch } = useStudio();
  return (
    <div className="min-w-0 rounded-xl border border-dashed border-line/70 p-2">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted/80">
        <span className="flex items-center gap-1">
          <Mini label="−" title="Narrower" onClick={() => dispatch({ kind: "cell-resize", r, c, delta: -1 })} />
          <span className="w-3 text-center">{span}</span>
          <Mini label="+" title="Wider" onClick={() => dispatch({ kind: "cell-resize", r, c, delta: 1 })} />
        </span>
        {canDelete && (
          <Mini
            label="✕"
            title="Remove box (widgets move to the neighbour)"
            onClick={() => dispatch({ kind: "cell-delete", r, c })}
          />
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function AddWidgetButton({ r, c, widgetCount }: { r: number; c: number; widgetCount: number }) {
  const { widgetSchemas, dispatch, setSel } = useStudio();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-sm text-muted hover:border-accent hover:text-accent"
      >
        ＋ Add widget
      </button>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {widgetSchemas.map((d) => (
        <button
          key={d.name}
          type="button"
          className="rounded-lg border border-line px-2 py-1.5 text-xs hover:border-accent"
          onClick={() => {
            setOpen(false);
            // Select the new widget so its editor opens immediately.
            dispatch({ kind: "widget-add", r, c, type: d.name }, () =>
              setSel({ r, c, w: widgetCount })
            );
          }}
        >
          {d.label}
        </button>
      ))}
      <button
        type="button"
        className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-foreground"
        onClick={() => setOpen(false)}
      >
        cancel
      </button>
    </div>
  );
}

export function RowChrome({
  r,
  cellCount,
  children,
}: {
  r: number;
  cellCount: number;
  children: React.ReactNode;
}) {
  const { dispatch } = useStudio();
  return (
    <div className="flex items-stretch gap-1.5">
      <EdgeButton title="Add box left" onClick={() => dispatch({ kind: "cell-add", r, at: 0 })} />
      <div className="min-w-0 flex-1">{children}</div>
      <EdgeButton
        title="Add box right"
        onClick={() => dispatch({ kind: "cell-add", r, at: cellCount })}
      />
      <div className="flex flex-col justify-center">
        <Mini label="✕" title="Remove row" onClick={() => dispatch({ kind: "row-delete", r })} />
      </div>
    </div>
  );
}

export function InsertRowBar({ at, prominent = false }: { at: number; prominent?: boolean }) {
  const { dispatch } = useStudio();
  if (prominent) {
    return (
      <div className="flex justify-center py-10">
        <button
          type="button"
          onClick={() => dispatch({ kind: "row-add", at })}
          className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold shadow hover:border-accent"
        >
          ＋ Add row
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      title="Add row here"
      onClick={() => dispatch({ kind: "row-add", at })}
      className="group my-1 flex w-full items-center gap-2 py-1 text-xs text-muted/40 hover:text-accent"
    >
      <span className="h-px flex-1 bg-line/60 group-hover:bg-accent" />
      ＋
      <span className="h-px flex-1 bg-line/60 group-hover:bg-accent" />
    </button>
  );
}

function EdgeButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-5 rounded-md border border-dashed border-line/70 text-xs text-muted/50 hover:border-accent hover:text-accent"
    >
      ＋
    </button>
  );
}

function Mini({
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
      onClick={onClick}
      className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}
