"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

/**
 * The drawing of the logical model as a floating window over the form
 * (Mark, 8-11-2026). A click on "Uit het model" opens it, zoomed to the
 * element, the field marked; Esc or a click beside it closes it. A click on
 * another field in the drawing closes it and jumps to the question that comes
 * from that field (via the traceregels), or says it has none.
 *
 * Free to handle (Mark, 8-11-2026): the wheel zooms around the cursor,
 * dragging the drawing moves it, the buttons (and + − 0) zoom, fit the
 * element or show the whole drawing — all of it the SVG's viewBox. The window
 * itself moves by its header and resizes by its lower right corner.
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
.omnium-dialog { position: fixed; inset: auto; margin: 0; resize: both; overflow: hidden;
  width: min(1200px, 94vw); height: 85vh; min-width: 360px; min-height: 260px; max-width: 100vw; max-height: 100vh; }
.omnium-dialog[open] { display: flex; flex-direction: column; }
.omnium-dialog::backdrop { background: rgb(15 23 42 / .45); }
.omnium-dialog > header { cursor: move; user-select: none; }
.omnium-dialog > header :is(a, button) { cursor: pointer; }
.omnium-dialog .omnium-svgbox { flex: 1 1 0; min-height: 0; cursor: grab; touch-action: none; }
.omnium-dialog .omnium-svgbox.is-dragging { cursor: grabbing; }
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

const ZOOM = "rounded border border-line px-2 py-0.5 leading-none text-muted hover:bg-surface hover:text-foreground";
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

type Box = [number, number, number, number];
const viewBox = (svg: SVGSVGElement): Box | undefined => {
  const v = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  return v.length === 4 && v.every(Number.isFinite) ? (v as Box) : undefined;
};
const setViewBox = (svg: SVGSVGElement, [x, y, w, h]: Box) => svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);

/** Zoom by `f` (< 1 is closer) around a point on the screen, or around the middle. */
export function zoomBy(svg: SVGSVGElement, f: number, clientX?: number, clientY?: number) {
  const v = viewBox(svg);
  if (!v) return;
  const [x, y, w, h] = v;
  const m = clientX !== undefined && clientY !== undefined ? svg.getScreenCTM()?.inverse() : undefined;
  const p = m && new DOMPoint(clientX, clientY).matrixTransform(m);
  const [cx, cy] = p ? [p.x, p.y] : [x + w / 2, y + h / 2];
  setViewBox(svg, [cx - (cx - x) * f, cy - (cy - y) * f, w * f, h * f]);
}

/** Keep at least a strip of the window (its header) on the screen. */
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function DiagramDialog({ drawings, rows, children }: { drawings: Drawing[]; rows: Record<string, string>; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const boxes = useRef<(HTMLDivElement | null)[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [whole, setWhole] = useState(false);
  const [refit, setRefit] = useState(0); // "element" or "hele tekening" again after zooming by hand
  const [note, setNote] = useState("");
  const pan = useRef<{ x: number; y: number; box: Box; scale: number; moved: boolean } | null>(null);
  const panned = useRef(false);
  const move = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const placed = useRef(false);

  const open = useCallback<Open>((t) => {
    setNote("");
    setWhole(false);
    setTarget(t);
    setRefit((n) => n + 1);
    const dlg = dialog.current;
    if (!dlg || dlg.open) return;
    dlg.showModal();
    // Centred the first time; after that where the reader left it (moved, resized).
    if (!placed.current) {
      placed.current = true;
      dlg.style.left = `${Math.max(0, (window.innerWidth - dlg.offsetWidth) / 2)}px`;
      dlg.style.top = `${Math.max(0, (window.innerHeight - dlg.offsetHeight) / 2)}px`;
    }
  }, []);

  const current = () => (target ? boxes.current[target.d]?.querySelector("svg") ?? undefined : undefined);

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
  }, [target, whole, refit]);

  // The wheel zooms around the cursor; React's onWheel is passive, so a native listener that may preventDefault.
  useEffect(() => {
    const els = boxes.current.filter((b): b is HTMLDivElement => Boolean(b));
    const onWheel = (e: WheelEvent) => {
      const svg = (e.currentTarget as HTMLElement).querySelector("svg");
      if (!svg) return;
      e.preventDefault();
      zoomBy(svg, Math.exp(Math.max(-1, Math.min(1, e.deltaY / 300))), e.clientX, e.clientY);
    };
    els.forEach((b) => b.addEventListener("wheel", onWheel, { passive: false }));
    return () => els.forEach((b) => b.removeEventListener("wheel", onWheel));
  }, [drawings]);

  // ── dragging the drawing (pan) ───────────────────────────────────────────
  function onPanDown(e: PointerEvent<HTMLDivElement>) {
    const svg = e.currentTarget.querySelector("svg");
    const box = svg && viewBox(svg);
    const m = svg?.getScreenCTM();
    if (!box || !m || e.button !== 0) return;
    panned.current = false;
    pan.current = { x: e.clientX, y: e.clientY, box, scale: m.a || 1, moved: false };
  }
  function onPanMove(e: PointerEvent<HTMLDivElement>) {
    const p = pan.current;
    const svg = e.currentTarget.querySelector("svg");
    if (!p || !svg) return;
    const [dx, dy] = [e.clientX - p.x, e.clientY - p.y];
    if (!p.moved && Math.hypot(dx, dy) < 4) return; // still a click, not a drag
    if (!p.moved) {
      p.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.classList.add("is-dragging");
    }
    const [x, y, w, h] = p.box;
    setViewBox(svg, [x - dx / p.scale, y - dy / p.scale, w, h]);
  }
  function onPanUp(e: PointerEvent<HTMLDivElement>) {
    panned.current = Boolean(pan.current?.moved);
    pan.current = null;
    e.currentTarget.classList.remove("is-dragging");
  }

  // ── dragging the window by its header ────────────────────────────────────
  function onMoveDown(e: PointerEvent<HTMLElement>) {
    const dlg = dialog.current;
    if (!dlg || e.button !== 0 || (e.target as Element).closest("a, button")) return;
    move.current = { x: e.clientX, y: e.clientY, left: dlg.offsetLeft, top: dlg.offsetTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMoveMove(e: PointerEvent<HTMLElement>) {
    const m = move.current;
    const dlg = dialog.current;
    if (!m || !dlg) return;
    dlg.style.left = `${clamp(m.left + e.clientX - m.x, 80 - dlg.offsetWidth, window.innerWidth - 80)}px`;
    dlg.style.top = `${clamp(m.top + e.clientY - m.y, 0, window.innerHeight - 40)}px`;
  }
  const onMoveUp = () => {
    move.current = null;
  };

  function onDrawingClick(e: MouseEvent) {
    if (panned.current) {
      panned.current = false; // the end of a drag is no click on a field
      return;
    }
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

  const zoom = (f: number) => {
    const svg = current();
    if (svg) zoomBy(svg, f);
  };
  const fit = (w: boolean) => {
    setWhole(w);
    setRefit((n) => n + 1);
  };

  const d = target ? drawings[target.d] : undefined;
  return (
    <Ctx.Provider value={open}>
      <style>{STYLE}</style>
      {children}
      <dialog
        ref={dialog}
        className="omnium-dialog rounded-xl border border-line bg-white p-0 text-sm text-foreground shadow-2xl"
        onClick={(e) => {
          // Only a click on the backdrop closes: the resize corner is the dialog itself too.
          const dlg = dialog.current;
          if (!dlg || e.target !== dlg) return;
          const r = dlg.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
        }}
        onClose={() => setNote("")}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === "+" || e.key === "=") zoom(0.8);
          else if (e.key === "-" || e.key === "_") zoom(1.25);
          else if (e.key === "0") fit(true);
          else return;
          e.preventDefault();
        }}
        aria-label={d ? `Tekening: ${d.title}` : "Tekening"}
      >
        <header
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3"
          onPointerDown={onMoveDown}
          onPointerMove={onMoveMove}
          onPointerUp={onMoveUp}
          onPointerCancel={onMoveUp}
        >
          <strong>{d?.title}</strong>
          {target && (
            <span className="text-muted">
              {whole ? "hele tekening" : `${target.id}${target.veld ? `, veld ${target.veld}` : ""}`}
              {d && (
                <>
                  {" · "}
                  <a href={d.href} className="underline-offset-2 hover:underline">
                    als pagina
                  </a>
                </>
              )}
            </span>
          )}
          {target && (
            <span className="flex items-center gap-1" role="group" aria-label="Zoomen">
              <button type="button" className={ZOOM} aria-label="Uitzoomen" title="Uitzoomen (−)" onClick={() => zoom(1.25)}>
                −
              </button>
              <button type="button" className={ZOOM} aria-label="Inzoomen" title="Inzoomen (+)" onClick={() => zoom(0.8)}>
                +
              </button>
              <button type="button" className={ZOOM} title="Terug naar het element" onClick={() => fit(false)}>
                element
              </button>
              <button type="button" className={ZOOM} title="Hele tekening (0)" onClick={() => fit(true)}>
                hele tekening
              </button>
            </span>
          )}
          <span className="ml-auto text-xs text-muted">Scrollen zoomt, slepen schuift · klik op een veld voor zijn vraag · Esc sluit</span>
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
            className="omnium-svgbox overflow-hidden p-2"
            onClick={onDrawingClick}
            onPointerDown={onPanDown}
            onPointerMove={onPanMove}
            onPointerUp={onPanUp}
            onPointerCancel={onPanUp}
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
