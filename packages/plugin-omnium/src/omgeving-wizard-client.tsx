"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lijnenVan } from "./omgeving-lijnen";
import type { Koppeling, ModelKnoop } from "./omgeving-wizard";

/**
 * The browser side of the omgevingswizard: the "doel" ticks (kept in this
 * browser only, nothing saved yet) and the split view of model and targets.
 */

const sleutel = (ns: string[]) => `imprint-omgevingswizard-doelen:${[...ns].sort().join(",")}`;

function leesDoelen(ns: string[]): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(sleutel(ns)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** One tick per recognised component: target for transformation and push. Kept per browser until the register can hold it. */
export function DoelVinkje({ ns, id, label, standaard }: { ns: string[]; id: string; label: string; standaard: boolean }) {
  const [aan, setAan] = useState(standaard);
  useEffect(() => {
    const d = leesDoelen(ns);
    if (d.size) setAan(d.has(id));
  }, [ns, id]);
  return (
    <label className="mt-3 flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={aan}
        aria-label={`${label} is doel voor uitrol`}
        onChange={(e) => {
          setAan(e.target.checked);
          try {
            const d = leesDoelen(ns);
            if (!d.size) d.add("__gezet__");
            if (e.target.checked) d.add(id);
            else d.delete(id);
            localStorage.setItem(sleutel(ns), JSON.stringify([...d]));
          } catch {
            /* private window: the tick just does not stick */
          }
        }}
      />
      doel voor uitrol
    </label>
  );
}

type Doel = { component: string; weergavenaam: string; laag: string; draaitHier: boolean; adres?: string; versie?: string; href?: string };

/** A line as drawn: the visible anchor on the left (the element, or its nearest open ancestor) and the link on the right. */
type Getekend = { id: string; koppeling: string; anker: string; x1: number; xa: number; y1: number; xb: number; x2: number; y2: number };
type Wijs = { koppeling?: string; anker?: string } | undefined;

/** Rendered and not inside a closed <details> (whose content keeps a box in current browsers, so client rects alone do not tell). */
const zichtbaar = (el: HTMLElement) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0);

/** The element for model id `id`, or, when it sits in a collapsed branch, the summary of the nearest visible ancestor. */
function zichtbaarAnker(box: HTMLElement, id: string): HTMLElement | null {
  let el = box.querySelector<HTMLElement>(`[data-anker="${CSS.escape(id)}"]`);
  while (el && !zichtbaar(el)) {
    let d = el.closest("details");
    if (d && d.querySelector(":scope > summary")?.contains(el)) d = d.parentElement?.closest("details") ?? null;
    if (!d) return null;
    el = d.querySelector<HTMLElement>(":scope > summary [data-anker]");
  }
  return el;
}

/**
 * Step 5: model left, targets right, and the lines between them (passive: the
 * links that follow from the artefacts). The lines come from `lijnenVan()` and
 * are redrawn when a branch opens or closes and when the layout changes; a
 * collapsed element hangs on its nearest visible ancestor. Pointing at a line,
 * an end or a model element lights up the other side; clicking chooses the
 * link. The active version (draw, move, erase) will edit the same lines.
 */
export function KoppelingenScherm({ model, doelen, koppelingen }: { model: ModelKnoop[]; doelen: Doel[]; koppelingen: Koppeling[] }) {
  const [gekozen, setGekozen] = useState<string | undefined>(koppelingen.find((k) => doelen.some((d) => d.draaitHier && d.component === k.doel.component))?.id);
  const [wijs, setWijs] = useState<Wijs>();
  const [getekend, setGetekend] = useState<Getekend[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const links = useRef<HTMLElement>(null);
  const rechts = useRef<HTMLElement>(null);
  const k = koppelingen.find((x) => x.id === gekozen);
  const licht = useMemo(() => new Set(k?.bron.ids ?? []), [k]);
  const lijnen = useMemo(() => lijnenVan(koppelingen), [koppelingen]);
  const perDoel = useMemo(() => {
    const m = new Map<string, Koppeling[]>();
    for (const x of koppelingen) m.set(x.doel.component, [...(m.get(x.doel.component) ?? []), x]);
    return m;
  }, [koppelingen]);

  const teken = useCallback(() => {
    const c = box.current;
    if (!c || !links.current || !rechts.current) return;
    if (!window.matchMedia("(min-width: 64rem)").matches) return setGetekend([]);
    const r0 = c.getBoundingClientRect();
    const xa = links.current.getBoundingClientRect().right - r0.left;
    const xb = rechts.current.getBoundingClientRect().left - r0.left;
    const gezien = new Set<string>();
    const uit: Getekend[] = [];
    for (const l of lijnen) {
      const a = zichtbaarAnker(c, l.van);
      const b = c.querySelector<HTMLElement>(`[data-koppeling="${CSS.escape(l.koppeling)}"]`);
      if (!a || !b || !zichtbaar(b)) continue;
      const id = `${a.dataset.anker}|${l.koppeling}`;
      if (gezien.has(id)) continue;
      gezien.add(id);
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      uit.push({ id, koppeling: l.koppeling, anker: a.dataset.anker!, x1: ra.right - r0.left + 4, xa, y1: ra.top + ra.height / 2 - r0.top, xb, x2: rb.left - r0.left - 4, y2: rb.top + rb.height / 2 - r0.top });
    }
    setGetekend(uit);
  }, [lijnen]);

  useLayoutEffect(() => teken(), [teken, gekozen]);
  useEffect(() => {
    const c = box.current;
    if (!c) return;
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(teken);
    };
    const ro = new ResizeObserver(later);
    ro.observe(c);
    c.addEventListener("toggle", later, true); // <details> open/close does not bubble
    window.addEventListener("resize", later);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener("toggle", later, true);
      window.removeEventListener("resize", later);
    };
  }, [teken]);

  const aan = (g: Getekend) => (wijs ? wijs.koppeling === g.koppeling || wijs.anker === g.anker : g.koppeling === gekozen);
  const aanLijnen = getekend.filter(aan);
  const aanKoppelingen = new Set(aanLijnen.map((g) => g.koppeling));
  const wijsAan = new Set(wijs ? aanLijnen.map((g) => g.anker) : []);

  return (
    <div ref={box} className="relative grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(5rem,1fr)_minmax(0,22rem)]" onMouseLeave={() => setWijs(undefined)}>
      <section ref={links} aria-label="Model" className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Model</h3>
        <ul className="space-y-1 text-sm">
          {model.map((n) => (
            <Knoop key={n.id} knoop={n} licht={licht} wijsAan={wijsAan} onWijs={setWijs} />
          ))}
        </ul>
      </section>
      <div aria-hidden="true" className="hidden lg:block" />
      <section ref={rechts} aria-label="Doelen" className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Doelen</h3>
        <ul className="space-y-3 text-sm">
          {doelen.map((d) => (
            <li key={d.component} className={d.component === k?.doel.component ? "rounded-lg bg-accent/10 p-2" : "p-2"}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{d.href ? <a href={d.href} className="hover:underline">{d.weergavenaam}</a> : d.weergavenaam}</span>
                <span className="text-xs text-muted">{d.laag}</span>
                {d.draaitHier ? (
                  <span className="rounded bg-accent/15 px-1.5 text-xs">draait hier{d.versie ? ` · ${d.versie}` : ""}</span>
                ) : (
                  <span className="rounded border border-line px-1.5 text-xs text-muted">niet in deze omgeving</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">API: {d.adres ? <code>{d.adres}</code> : "nog niet bekend"} · OpenAPI-beschrijving volgt</p>
              <ul className="mt-2 space-y-1 border-l border-line pl-3">
                {(perDoel.get(d.component) ?? []).map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      data-koppeling={x.id}
                      onClick={() => setGekozen(x.id)}
                      onMouseEnter={() => setWijs({ koppeling: x.id })}
                      onFocus={() => setWijs({ koppeling: x.id })}
                      onBlur={() => setWijs(undefined)}
                      aria-pressed={x.id === gekozen}
                      className={`text-left hover:underline ${x.id === gekozen ? "font-semibold text-accent" : aanKoppelingen.has(x.id) ? "text-accent" : ""}`}
                    >
                      {x.naam}
                    </button>{" "}
                    <span className="text-xs text-muted">{x.soort}</span>
                  </li>
                ))}
                {!perDoel.get(d.component)?.length && <li className="text-xs text-muted">nog geen koppelingen</li>}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block">
        {[...getekend.filter((g) => !aan(g)), ...aanLijnen].map((g) => {
          const xm = (g.xa + g.xb) / 2;
          const boog = `M ${g.xa} ${g.y1} C ${xm} ${g.y1}, ${xm} ${g.y2}, ${g.xb} ${g.y2}`;
          const d = `M ${g.x1} ${g.y1} H ${g.xa} C ${xm} ${g.y1}, ${xm} ${g.y2}, ${g.xb} ${g.y2} H ${g.x2}`;
          const op = aan(g);
          return (
            <g key={g.id} className={op ? "text-accent" : "text-muted"}>
              <path d={d} fill="none" stroke="currentColor" strokeWidth={op ? 2 : 1} opacity={op ? 1 : 0.45} />
              {/* The hit area only between the columns, so the tree and the links stay clickable. */}
              <path
                d={boog}
                fill="none"
                stroke="transparent"
                strokeWidth={10}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onMouseEnter={() => setWijs({ koppeling: g.koppeling })}
                onClick={() => setGekozen(g.koppeling)}
              />
              <circle cx={g.xa} cy={g.y1} r={op ? 3.5 : 2.5} fill="currentColor" style={{ pointerEvents: "all" }} onMouseEnter={() => setWijs({ anker: g.anker })} />
              <circle cx={g.xb} cy={g.y2} r={op ? 3.5 : 2.5} fill="currentColor" style={{ pointerEvents: "all" }} onMouseEnter={() => setWijs({ koppeling: g.koppeling })} />
            </g>
          );
        })}
      </svg>
      <section aria-label="Gekozen koppeling" className="rounded-xl border border-line bg-surface p-4 text-sm lg:col-span-3" aria-live="polite">
        {k ? (
          <>
            <p className="font-medium">
              {k.naam}: <span className="text-muted">{k.bron.label}</span> → {k.doel.weergavenaam}
            </p>
            <p className="mt-1 text-muted">
              Afgeleid uit het artefact dat de generatie maakte. Een koppeling verfijnen (preciezere punten, een transformatie kiezen of maken) volgt
              zodra het register Koppeling en Transformatie kent.{" "}
              {k.href && (
                <a href={k.href} className="text-accent hover:underline">
                  Bekijk het artefact →
                </a>
              )}
            </p>
          </>
        ) : (
          <p className="text-muted">Kies rechts een koppeling of een lijn: links lichten de modelelementen op die ze leest.</p>
        )}
      </section>
    </div>
  );
}

function Knoop({ knoop, licht, wijsAan, onWijs, diepte = 0 }: { knoop: ModelKnoop; licht: Set<string>; wijsAan: Set<string>; onWijs: (w: Wijs) => void; diepte?: number }) {
  const aan = licht.has(knoop.id) || knoop.kinderen.some((c) => licht.has(c.id));
  const binnen = (n: ModelKnoop): boolean => licht.has(n.id) || n.kinderen.some(binnen);
  const open = diepte === 0 ? binnen(knoop) : aan;
  const label = (
    <span
      data-anker={knoop.id}
      onMouseEnter={() => onWijs({ anker: knoop.id })}
      className={aan ? "rounded bg-accent/15 px-1 font-medium" : wijsAan.has(knoop.id) ? "rounded bg-accent/10 px-1" : ""}
    >
      {knoop.href ? <a href={knoop.href} className="hover:underline">{knoop.label}</a> : knoop.label}
      {knoop.soort !== "veld" && knoop.soort !== "domein" && knoop.soort !== "groep" && <span className="ml-1 text-xs text-muted">{knoop.soort}</span>}
    </span>
  );
  if (!knoop.kinderen.length) return <li style={{ paddingLeft: diepte ? 4 : 0 }}>{label}</li>;
  return (
    <li>
      <details open={open || undefined} key={String(open)}>
        <summary className="cursor-pointer">{label}</summary>
        <ul className="ml-4 space-y-1 border-l border-line pl-3">
          {knoop.kinderen.map((c) => (
            <Knoop key={c.id} knoop={c} licht={licht} wijsAan={wijsAan} onWijs={onWijs} diepte={diepte + 1} />
          ))}
        </ul>
      </details>
    </li>
  );
}
