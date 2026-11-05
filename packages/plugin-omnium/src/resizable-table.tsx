"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A table whose columns you can widen or narrow by dragging the edge of a
 * header cell. The table is rendered on the server as is; this island only
 * adds a grip to every `<th>` after hydration. On the first drag the current
 * widths are fixed (`table-layout: fixed`), so the other columns keep their
 * width while one changes. A double click on a grip gives the column back to
 * the automatic layout.
 */
export function ResizableTable({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const heads = Array.from(table.querySelectorAll<HTMLTableCellElement>(":scope > thead > tr > th"));
    const cleanups: (() => void)[] = [];

    const freeze = () => {
      if (table.style.tableLayout === "fixed") return;
      const widths = heads.map((th) => th.getBoundingClientRect().width);
      heads.forEach((th, n) => (th.style.width = `${widths[n]}px`));
      table.style.width = `${table.getBoundingClientRect().width}px`;
      table.style.tableLayout = "fixed";
    };

    heads.forEach((th) => {
      th.style.position = "relative";
      const grip = document.createElement("span");
      grip.setAttribute("aria-hidden", "true");
      grip.title = "Sleep om de kolom breder of smaller te maken";
      grip.className = "absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-accent/30";
      th.appendChild(grip);

      const down = (e: PointerEvent) => {
        e.preventDefault();
        freeze();
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        const startT = table.getBoundingClientRect().width;
        grip.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          const w = Math.max(48, startW + ev.clientX - startX);
          th.style.width = `${w}px`;
          table.style.width = `${startT + (w - startW)}px`;
        };
        const up = () => {
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
      };
      const reset = () => {
        heads.forEach((h) => (h.style.width = ""));
        table.style.width = "";
        table.style.tableLayout = "";
      };
      grip.addEventListener("pointerdown", down);
      grip.addEventListener("dblclick", reset);
      cleanups.push(() => grip.remove());
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <table ref={ref} className={className}>
      {children}
    </table>
  );
}
