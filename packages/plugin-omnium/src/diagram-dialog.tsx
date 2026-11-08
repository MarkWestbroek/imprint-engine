"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/**
 * The drawing of the logical model as a floating window over the form
 * (Mark, 8-11-2026). A click on "Uit het model" opens it, zoomed to the
 * element, the field marked; Esc or a click beside it closes it. A click on
 * another field in the drawing closes it and jumps to the question that comes
 * from that field (via the traceregels), or says it has none.
 *
 * The drawings arrive sanitised from the server (`sanitizeSvg`) and are put in
 * the page once; highlighting and zoom happen here, on the live SVG, so the
 * real box of an element is used (`getBoundingClientRect`), nested or not.
 */

export type Drawing = { title: string; href: string; svg: string };
type Target = { d: number; id: string; veld?: string };
type Open = (t: Target) => void;

const Ctx = createContext<Open | null>(null);

const STYLE = `
.omnium-dialog::backdrop { background: rgb(15 23 42 / .45); }
.omnium-dialog .omnium-svgbox svg { width: 100%; height: 100%; }
.omnium-dialog [data-lit] rect:not(.omnium-veld), .omnium-dialog [data-lit] circle, .omnium-dialog [data-lit] ellipse,
.omnium-dialog [data-lit] polygon, .omnium-dialog [data-lit] path { stroke: #e11d48 !important; stroke-width: 4px !important; }
.omnium-dialog [data-lit] > rect:first-of-type { fill: #fff1c2 !important; }
.omnium-dialog .is-lit [data-element-id]:not([data-lit]):not(:has([data-lit])) { opacity: .3; }
.omnium-dialog .is-lit [data-lit] [data-element-id] { opacity: 1; }
.omnium-dialog [data-dc-veld] { cursor: pointer; }
.omnium-dialog [data-dc-veld]:hover { text-decoration: underline; }
.omnium-flash > td { background: #fef08a; }
`;

const SVGNS = "http://www.w3.org/2000/svg";

/** Light up `id` (and its field `veld`) in `svg` and zoom to it; undo what an earlier call did. */
function light(svg: SVGSVGElement, id: string, veld?: string) {
  svg.querySelectorAll(".omnium-veld").forEach((r) => r.remove());
  svg.querySelectorAll("[data-lit]").forEach((e) => e.removeAttribute("data-lit"));
  const original = svg.dataset.viewbox ?? svg.getAttribute("viewBox") ?? "";
  svg.dataset.viewbox = original;
  svg.setAttribute("viewBox", original);
  const el = Array.from(svg.querySelectorAll<SVGGraphicsElement>("[data-element-id]")).find((e) => e.getAttribute("data-element-id") === id);
  if (!el) return false;
  el.setAttribute("data-lit", "");
  if (veld) {
    const text = Array.from(el.querySelectorAll<SVGTextElement>("text[data-dc-veld]")).find((t) => t.textContent?.trim() === veld);
    const box = el.querySelector(":scope > rect");
    if (text) {
      const b = text.getBBox();
      const bar = document.createElementNS(SVGNS, "rect");
      bar.setAttribute("class", "omnium-veld");
      bar.setAttribute("x", "3");
      bar.setAttribute("y", String(b.y - 2));
      bar.setAttribute("width", String(Math.max(Number(box?.getAttribute("width") ?? b.width + 10) - 4, b.width)));
      bar.setAttribute("height", String(b.height + 4));
      bar.setAttribute("rx", "3");
      bar.setAttribute("fill", "#fde047");
      text.parentNode?.insertBefore(bar, text);
    }
  }
  // The element's box in the drawing's own units: from the screen back through the SVG's matrix.
  const m = svg.getScreenCTM()?.inverse();
  const r = el.getBoundingClientRect();
  if (!m || !r.width) return true;
  const a = new DOMPoint(r.left, r.top).matrixTransform(m);
  const b = new DOMPoint(r.right, r.bottom).matrixTransform(m);
  const [w, h] = [b.x - a.x, b.y - a.y];
  const pad = Math.max(w, h, 200) * 0.8;
  svg.setAttribute("viewBox", `${a.x - pad} ${a.y - pad * 0.6} ${w + 2 * pad} ${h + 1.2 * pad}`);
  return true;
}

export function DiagramDialog({ drawings, rows, children }: { drawings: Drawing[]; rows: Record<string, string>; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const boxes = useRef<(HTMLDivElement | null)[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [whole, setWhole] = useState(false);
  const [note, setNote] = useState("");

  const open = useCallback<Open>((t) => {
    setNote("");
    setWhole(false);
    setTarget(t);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  useLayoutEffect(() => {
    if (!target) return;
    const svg = boxes.current[target.d]?.querySelector("svg");
    if (!svg) return;
    if (whole) {
      svg.parentElement?.classList.remove("is-lit");
      light(svg, "\u0000");
      return;
    }
    const found = light(svg, target.id, target.veld);
    svg.parentElement?.classList.toggle("is-lit", found);
  }, [target, whole]);

  function onDrawingClick(e: MouseEvent) {
    const text = (e.target as Element).closest("[data-dc-veld]");
    const el = (e.target as Element).closest("[data-element-id]");
    if (!text || !el) return;
    const veld = text.textContent?.trim() ?? "";
    const row = rows[`${el.getAttribute("data-element-id")}|${veld}`];
    if (!row) {
      setNote(`“${veld}” komt in dit formulier niet als vraag voor.`);
      return;
    }
    dialog.current?.close();
    const tr = document.getElementById(row);
    if (!tr) return;
    tr.scrollIntoView({ block: "center", behavior: "smooth" });
    tr.focus({ preventScroll: true });
    tr.classList.add("omnium-flash");
    window.setTimeout(() => tr.classList.remove("omnium-flash"), 2000);
  }

  const d = target ? drawings[target.d] : undefined;
  return (
    <Ctx.Provider value={open}>
      <style>{STYLE}</style>
      {children}
      <dialog
        ref={dialog}
        className="omnium-dialog m-auto w-[min(1200px,94vw)] max-w-none rounded-xl border border-line bg-white p-0 text-sm text-foreground shadow-2xl"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        onClose={() => setNote("")}
        aria-label={d ? `Tekening: ${d.title}` : "Tekening"}
      >
        <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-3">
          <strong>{d?.title}</strong>
          {target && (
            <span className="text-muted">
              {whole ? "hele tekening" : `${target.id}${target.veld ? `, veld ${target.veld}` : ""}`} ·{" "}
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => setWhole((w) => !w)}>
                {whole ? "terug naar het element" : "hele tekening"}
              </button>{" "}
              · {d && <a href={d.href} className="underline-offset-2 hover:underline">als pagina</a>}
            </span>
          )}
          <span className="ml-auto text-xs text-muted">Klik op een veld om naar zijn vraag te gaan · Esc sluit</span>
          <button type="button" aria-label="Sluiten" className="text-lg leading-none text-muted hover:text-foreground" onClick={() => dialog.current?.close()}>
            ×
          </button>
        </header>
        {note && <p className="border-b border-line bg-surface px-4 py-2">{note}</p>}
        {drawings.map((x, n) => (
          <div
            key={n}
            ref={(el) => {
              boxes.current[n] = el;
            }}
            hidden={target?.d !== n}
            className="omnium-svgbox h-[72vh] overflow-auto p-2"
            onClick={onDrawingClick}
            dangerouslySetInnerHTML={{ __html: x.svg }}
          />
        ))}
      </dialog>
    </Ctx.Provider>
  );
}

/** A link to an element in a drawing that opens the window instead (a plain link without JavaScript, or in a new tab). */
export function DiagramLink({ href, d, id, veld, title, children }: Target & { href: string; title?: string; children: ReactNode }) {
  const open = useContext(Ctx);
  return (
    <a
      href={href}
      title={title}
      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
      onClick={(e) => {
        if (!open || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open({ d, id, veld });
      }}
    >
      {children}
    </a>
  );
}
