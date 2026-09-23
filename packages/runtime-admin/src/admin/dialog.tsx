"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eigen bevestig/vraag-dialoog voor de admin, in plaats van de ouderwetse
 * window.confirm/prompt: hij popt op bij de muis (waar je net klikte), in
 * de huisstijl. Gebruik: `await confirmDialog("…?")` → boolean, of
 * `await promptDialog("Titel?")` → string | null. De <DialogHost/> hangt
 * één keer in de AdminShell; zonder host vallen we terug op de native
 * dialogen (werkt dus ook buiten de admin).
 */

type Pending =
  | {
      kind: "confirm";
      message: string;
      confirmLabel: string;
      danger: boolean;
      x: number;
      y: number;
      resolve: (ok: boolean) => void;
    }
  | {
      kind: "prompt";
      message: string;
      confirmLabel: string;
      placeholder: string;
      initial: string;
      x: number;
      y: number;
      resolve: (value: string | null) => void;
    };

let openDialog: ((p: Pending) => void) | null = null;
let mouse = { x: 0, y: 0 };

export function confirmDialog(
  message: string,
  opts?: { confirmLabel?: string; danger?: boolean }
): Promise<boolean> {
  if (!openDialog) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    openDialog!({
      kind: "confirm",
      message,
      confirmLabel: opts?.confirmLabel ?? "OK",
      danger: opts?.danger ?? false,
      ...mouse,
      resolve,
    })
  );
}

export function promptDialog(
  message: string,
  opts?: { confirmLabel?: string; placeholder?: string; initial?: string }
): Promise<string | null> {
  if (!openDialog) return Promise.resolve(window.prompt(message, opts?.initial ?? ""));
  return new Promise((resolve) =>
    openDialog!({
      kind: "prompt",
      message,
      confirmLabel: opts?.confirmLabel ?? "OK",
      placeholder: opts?.placeholder ?? "",
      initial: opts?.initial ?? "",
      ...mouse,
      resolve,
    })
  );
}

const PANEL_W = 320;

export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openDialog = (p) => {
      setPending(p);
      setValue(p.kind === "prompt" ? p.initial : "");
    };
    // Positie = laatste pointerdown; capture zodat hij vóór click-handlers vuurt.
    const track = (e: PointerEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointerdown", track, true);
    return () => {
      openDialog = null;
      window.removeEventListener("pointerdown", track, true);
    };
  }, []);

  const close = (result: boolean | string | null) => {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(Boolean(result));
    else pending.resolve(typeof result === "string" ? result : null);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter" && pending.kind === "confirm") close(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  if (!pending) return null;

  // Bij de muis, maar binnen beeld (met een kleine offset onder de cursor).
  const left = Math.max(12, Math.min(pending.x - 40, window.innerWidth - PANEL_W - 12));
  const top = Math.max(12, Math.min(pending.y + 12, window.innerHeight - 190));

  return (
    <div className="fixed inset-0 z-50" onPointerDown={() => close(null)}>
      <div
        ref={panel}
        role="dialog"
        aria-modal
        onPointerDown={(e) => e.stopPropagation()}
        style={{ left, top, width: PANEL_W }}
        className="fixed rounded-lg border border-line bg-surface p-4 shadow-2xl shadow-black/40"
      >
        <p className="whitespace-pre-line text-sm">{pending.message}</p>
        {pending.kind === "prompt" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              close(value);
            }}
          >
            <input
              autoFocus
              value={value}
              placeholder={pending.placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="mt-3 w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
          </form>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(null)}
            className="rounded-md border border-line px-3 py-1 text-sm text-muted hover:text-foreground"
          >
            Annuleer
          </button>
          <button
            type="button"
            autoFocus={pending.kind === "confirm"}
            onClick={() => close(pending.kind === "prompt" ? value : true)}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${
              pending.kind === "confirm" && pending.danger
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : "bg-accent text-background hover:bg-accent-strong"
            }`}
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
