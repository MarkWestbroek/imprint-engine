"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lijnenVan } from "./omgeving-lijnen";
import type { Koppeling, ModelKnoop } from "./omgeving-wizard";
import type { KoppelingHandeling } from "./koppeling-register";
import type { KoppelingResultaat } from "./koppeling-opslaan";
import type { ScanComponent } from "./omgeving-scan";
import { controleerOpname, isOpneembaar, type Opname } from "./component-opname";

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

const opnameSleutel = (ns: string[]) => `imprint-omgevingswizard-opnemen:${[...ns].sort().join(",")}`;

function leesOpnames(ns: string[]): Record<string, Opname> {
  try {
    return JSON.parse(localStorage.getItem(opnameSleutel(ns)) ?? "{}") as Record<string, Opname>;
  } catch {
    return {};
  }
}

function schrijfOpname(ns: string[], id: string, o: Opname | undefined) {
  try {
    const alle = leesOpnames(ns);
    if (o) alle[id] = o;
    else delete alle[id];
    localStorage.setItem(opnameSleutel(ns), JSON.stringify(alle));
  } catch {
    /* private window: the choice just does not stick */
  }
}

/**
 * An unrecognised workload in step 3: take it in as a new component (name,
 * layer, recognition rule, target tick) or leave it out. Checked as the
 * register would need it (component-opname.ts); kept in this browser only.
 */
export function OpnemenKaart({
  ns,
  id,
  scan,
  voorstel,
  bestaandeNamen,
  lagen,
}: {
  ns: string[];
  id: string;
  scan: ScanComponent;
  voorstel: Opname;
  bestaandeNamen: string[];
  lagen: string[];
}) {
  const [opname, setOpname] = useState<Opname | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpname(leesOpnames(ns)[id]), [ns, id]);
  const [o, setO] = useState<Opname>(voorstel);
  useEffect(() => setO(opname ?? voorstel), [opname, voorstel]);
  const bevindingen = controleerOpname(o, { bestaandeNamen, lagen, scan });
  const veldId = (v: string) => `${id}-${v}`.replace(/[^a-zA-Z0-9-]/g, "-");
  // The message sits outside the label (it is no part of the field's name) and is tied to the field with aria-describedby.
  const van = (veld: string) => bevindingen.filter((b) => b.veld === veld);
  const melding = (veld: string) => (
    <p id={`${veldId(veld)}-melding`} aria-live="polite" className="text-xs">
      {van(veld).map((b) => (
        <span key={b.melding} className={`block ${b.ernst === "fout" ? "text-red-700" : "text-muted"}`}>
          {b.melding}
        </span>
      ))}
    </p>
  );
  const aria = (veld: string) => ({ "aria-describedby": `${veldId(veld)}-melding`, "aria-invalid": van(veld).some((b) => b.ernst === "fout") || undefined });

  if (!open) {
    return (
      <div className="mt-3 text-sm">
        {opname ? (
          <p>
            Opnemen als <strong>{opname.weergavenaam}</strong> ({opname.laag}){opname.doel ? ", doel voor uitrol" : ""}.{" "}
            <button type="button" className="text-accent hover:underline" onClick={() => setOpen(true)}>
              Wijzigen
            </button>
          </p>
        ) : (
          <p className="text-xs text-muted">
            {scan.herkend ? "Herkend, maar niet in het register: geen doel." : "Niet herkend: geen doel."}{" "}
            <button type="button" className="text-accent hover:underline" onClick={() => setOpen(true)}>
              Opnemen als component…
            </button>
          </p>
        )}
      </div>
    );
  }
  return (
    <form
      className="mt-3 space-y-2 border-t border-line pt-3 text-sm"
      aria-label={`${scan.naam} opnemen als component`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!isOpneembaar(bevindingen)) return;
        const schoon = { ...o, naam: o.naam.trim(), weergavenaam: o.weergavenaam.trim() };
        schrijfOpname(ns, id, schoon);
        setOpname(schoon);
        setOpen(false);
      }}
    >
      <div>
        <label className="text-xs text-muted" htmlFor={veldId("naam")}>naam</label>
        <input
          id={veldId("naam")}
          {...aria("naam")}
          className="block w-full rounded border border-line bg-surface px-2 py-1"
          value={o.naam}
          onChange={(e) => setO({ ...o, naam: e.target.value })}
        />
        {melding("naam")}
      </div>
      <div>
        <label className="text-xs text-muted" htmlFor={veldId("weergavenaam")}>weergavenaam</label>
        <input
          id={veldId("weergavenaam")}
          {...aria("weergavenaam")}
          className="block w-full rounded border border-line bg-surface px-2 py-1"
          value={o.weergavenaam}
          onChange={(e) => setO({ ...o, weergavenaam: e.target.value })}
        />
        {melding("weergavenaam")}
      </div>
      <div>
        <label className="text-xs text-muted" htmlFor={veldId("laag")}>laag</label>
        <select
          id={veldId("laag")}
          {...aria("laag")}
          className="block w-full rounded border border-line bg-surface px-2 py-1"
          value={o.laag}
          onChange={(e) => setO({ ...o, laag: e.target.value })}
        >
          <option value="">kies…</option>
          {lagen.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        {melding("laag")}
      </div>
      <fieldset>
        <legend className="text-xs text-muted">herkennen aan</legend>
        <div className="flex gap-2">
          <select
            aria-label="soort herkenning"
            className="rounded border border-line bg-surface px-2 py-1"
            value={o.herkenning.soort}
            onChange={(e) => setO({ ...o, herkenning: { ...o.herkenning, soort: e.target.value as Opname["herkenning"]["soort"] } })}
          >
            <option value="image">image</option>
            <option value="chart">chart</option>
          </select>
          <input
            aria-label="patroon (reguliere expressie)"
            {...aria("herkenning.patroon")}
            className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 font-mono text-xs"
            value={o.herkenning.patroon}
            onChange={(e) => setO({ ...o, herkenning: { ...o.herkenning, patroon: e.target.value } })}
          />
        </div>
        {melding("herkenning.patroon")}
      </fieldset>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={o.doel} onChange={(e) => setO({ ...o, doel: e.target.checked })} />
        doel voor uitrol
      </label>
      <div className="flex flex-wrap gap-3 pt-1">
        <button type="submit" disabled={!isOpneembaar(bevindingen)} className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50">
          Bewaren
        </button>
        <button type="button" className="text-muted hover:underline" onClick={() => { setO(opname ?? voorstel); setOpen(false); }}>
          Annuleren
        </button>
        {opname && (
          <button
            type="button"
            className="text-muted hover:underline"
            onClick={() => {
              schrijfOpname(ns, id, undefined);
              setOpname(undefined);
              setOpen(false);
            }}
          >
            Niet opnemen
          </button>
        )}
      </div>
    </form>
  );
}

type Doel = { component: string; weergavenaam: string; laag: string; draaitHier: boolean; adres?: string; versie?: string; href?: string; componentId?: number };

/** Editing the lines (only for an editor, and only when the site can write): the save action and the e-dienstversies to hang a new line on. */
export type Bewerken = { opslaan: (h: KoppelingHandeling) => Promise<KoppelingResultaat>; edienstversies: { id: number; label: string }[] };

/** A drag in progress: a new line from a model element, or one end of a laid-down line. */
type Trek =
  | { soort: "nieuw"; bron: { bronSoort: string; bronElementId: string; naampad?: string }; label: string; x0: number; y0: number; x: number; y: number }
  | { soort: "verleg-bron" | "verleg-doel"; koppeling: Koppeling; x0: number; y0: number; x: number; y: number };

/** What starts a drag (the positions come from the pointer). */
type TrekStart = Trek extends infer T ? (T extends Trek ? Omit<T, "x0" | "y0" | "x" | "y"> : never) : never;

/** An action waiting to be saved (one registration each), with its outcome. */
type Wacht = { id: number; h: KoppelingHandeling; omschrijving: string; status: "wacht" | "bezig" | "ok" | "fout"; melding?: string };

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
export function KoppelingenScherm({ model, doelen, koppelingen, bewerken }: { model: ModelKnoop[]; doelen: Doel[]; koppelingen: Koppeling[]; bewerken?: Bewerken }) {
  const [gekozen, setGekozen] = useState<string | undefined>(koppelingen.find((k) => doelen.some((d) => d.draaitHier && d.component === k.doel.component))?.id);
  const [wijs, setWijs] = useState<Wijs>();
  const [getekend, setGetekend] = useState<Getekend[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const links = useRef<HTMLElement>(null);
  const rechts = useRef<HTMLElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ev, setEv] = useState<number | undefined>(
    () => koppelingen.find((x) => x.herkomst === "register")?.edienstversieIds?.[0] ?? bewerken?.edienstversies[0]?.id
  );
  const [trek, setTrek] = useState<Trek>();
  const [wachtrij, setWachtrij] = useState<Wacht[]>([]);
  const volgnr = useRef(0);
  const doelNaam = (componentId: number) => doelen.find((d) => d.componentId === componentId)?.weergavenaam ?? `component ${componentId}`;

  const zet = (h: KoppelingHandeling, omschrijving: string) => setWachtrij((w) => [...w, { id: ++volgnr.current, h, omschrijving, status: "wacht" }]);
  const binnen = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // While dragging: follow the pointer; on release, see what is under it (a target, or a model entity).
  useEffect(() => {
    if (!trek) return;
    const beweeg = (e: PointerEvent) => setTrek((t) => (t ? { ...t, ...binnen(e) } : t));
    const los = (e: PointerEvent) => {
      const onder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const doel = onder?.closest<HTMLElement>("[data-doel]");
      const anker = onder?.closest<HTMLElement>("[data-bron-soort]");
      const componentId = doel ? Number(doel.dataset.doel) : undefined;
      if (trek.soort === "nieuw" && componentId && ev !== undefined) {
        const naam = `${trek.label} wordt ${doelNaam(componentId)}`;
        zet({ soort: "nieuw", edienstversieId: ev, naam, bron: trek.bron, componentId }, `Nieuw: ${naam}`);
      } else if (trek.soort === "verleg-doel" && componentId && trek.koppeling.registerId !== undefined) {
        zet({ soort: "verleg-doel", koppelingId: trek.koppeling.registerId, componentId }, `Verleg ${trek.koppeling.naam} naar ${doelNaam(componentId)}`);
      } else if (trek.soort === "verleg-bron" && anker && trek.koppeling.registerId !== undefined) {
        const bron = { bronSoort: anker.dataset.bronSoort!, bronElementId: anker.dataset.bronId!, naampad: anker.dataset.naampad };
        zet({ soort: "verleg-bron", koppelingId: trek.koppeling.registerId, bron }, `Verleg ${trek.koppeling.naam} naar ${anker.dataset.naampad ?? bron.bronElementId}`);
      }
      setTrek(undefined);
    };
    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", los, { once: true });
    return () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", los);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed per drag
  }, [trek?.soort, trek?.x0, trek?.y0]);

  const begin = (e: React.PointerEvent, t: TrekStart) => {
    if (!bewerken || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = binnen(e);
    setTrek({ ...t, x0: p.x, y0: p.y, ...p } as Trek);
  };
  const beginNieuw = (e: React.PointerEvent, knoop: ModelKnoop, bron: { bronSoort: string; bronElementId: string; naampad: string }) =>
    begin(e, { soort: "nieuw", bron, label: knoop.label });

  const bewaar = (w: Wacht) => {
    if (!bewerken) return;
    setWachtrij((q) => q.map((x) => (x.id === w.id ? { ...x, status: "bezig", melding: undefined } : x)));
    startTransition(async () => {
      const r = await bewerken.opslaan(w.h).catch(() => ({ ok: false as const, fout: "Opslaan mislukte (geen antwoord van de site)." }));
      setWachtrij((q) => q.map((x) => (x.id === w.id ? { ...x, status: r.ok ? "ok" : "fout", melding: r.ok ? r.melding : r.fout } : x)));
      if (r.ok) router.refresh();
    });
  };
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
        {bewerken && (
          <label className="mb-3 block text-xs">
            <span className="text-muted">Nieuwe lijnen hangen aan e-dienstversie</span>
            <select value={ev ?? ""} onChange={(e) => setEv(Number(e.target.value))} className="mt-1 block w-full rounded border border-line bg-background px-2 py-1 text-sm">
              {bewerken.edienstversies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-muted">Sleep vanaf het bolletje achter een entiteit, gegevenselement of veld naar een doel.</span>
          </label>
        )}
        <ul className="space-y-1 text-sm">
          {model.map((n) => (
            <Knoop key={n.id} knoop={n} licht={licht} wijsAan={wijsAan} onWijs={setWijs} pad={[]} onTrek={bewerken ? beginNieuw : undefined} />
          ))}
        </ul>
      </section>
      <div aria-hidden="true" className="hidden lg:block" />
      <section ref={rechts} aria-label="Doelen" className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Doelen</h3>
        <ul className="space-y-3 text-sm">
          {doelen.map((d) => (
            <li
              key={d.component}
              data-doel={bewerken && d.componentId !== undefined ? d.componentId : undefined}
              className={`${d.component === k?.doel.component ? "rounded-lg bg-accent/10 p-2" : "p-2"} ${trek && trek.soort !== "verleg-bron" && d.componentId !== undefined ? "rounded-lg outline-dashed outline-1 outline-accent" : ""}`}
            >
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
              {(() => {
                const kk = koppelingen.find((x) => x.id === g.koppeling);
                const verplaatsbaar = Boolean(bewerken && kk?.herkomst === "register");
                const stijl = { pointerEvents: "all" as const, cursor: verplaatsbaar ? "grab" : undefined };
                return (
                  <>
                    <circle
                      cx={g.xa}
                      cy={g.y1}
                      r={verplaatsbaar ? 5 : op ? 3.5 : 2.5}
                      fill="currentColor"
                      style={stijl}
                      onMouseEnter={() => setWijs({ anker: g.anker })}
                      onPointerDown={verplaatsbaar ? (e) => begin(e, { soort: "verleg-bron", koppeling: kk! }) : undefined}
                    >
                      {verplaatsbaar && <title>Sleep naar een ander modelelement om de bron te verleggen</title>}
                    </circle>
                    <circle
                      cx={g.xb}
                      cy={g.y2}
                      r={verplaatsbaar ? 5 : op ? 3.5 : 2.5}
                      fill="currentColor"
                      style={stijl}
                      onMouseEnter={() => setWijs({ koppeling: g.koppeling })}
                      onPointerDown={verplaatsbaar ? (e) => begin(e, { soort: "verleg-doel", koppeling: kk! }) : undefined}
                    >
                      {verplaatsbaar && <title>Sleep naar een ander doel om de koppeling te verleggen</title>}
                    </circle>
                  </>
                );
              })()}
            </g>
          );
        })}
        {trek && (
          <path
            d={`M ${trek.x0} ${trek.y0} C ${(trek.x0 + trek.x) / 2} ${trek.y0}, ${(trek.x0 + trek.x) / 2} ${trek.y}, ${trek.x} ${trek.y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="6 4"
            className="text-accent"
          />
        )}
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
        {bewerken && k?.herkomst === "register" && k.registerId !== undefined && (
          <button
            type="button"
            onClick={() => zet({ soort: "wis", koppelingId: k.registerId! }, `Wis ${k.naam}`)}
            className="mt-3 rounded-md border border-line px-3 py-1 text-sm hover:border-accent"
          >
            Lijn wissen…
          </button>
        )}
      </section>
      {bewerken && wachtrij.length > 0 && (
        <section aria-label="Nog op te slaan" className="rounded-xl border border-accent/40 bg-surface p-4 text-sm lg:col-span-3" aria-live="polite">
          <h3 className="mb-2 font-semibold">Wijzigingen</h3>
          <p className="mb-3 text-xs text-muted">Elke wijziging is één registratie in het register. Pas Opslaan schrijft; Weg laat haar vallen.</p>
          <ul className="space-y-2">
            {wachtrij.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2">
                {w.h.soort === "nieuw" && w.status !== "ok" ? (
                  <input
                    aria-label="Naam van de nieuwe koppeling"
                    value={w.h.naam}
                    onChange={(e) => setWachtrij((q) => q.map((x) => (x.id === w.id && x.h.soort === "nieuw" ? { ...x, h: { ...x.h, naam: e.target.value } } : x)))}
                    className="min-w-64 flex-1 rounded border border-line bg-background px-2 py-1"
                  />
                ) : (
                  <span className="flex-1">{w.omschrijving}</span>
                )}
                {w.status === "wacht" || w.status === "fout" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => bewaar(w)}
                      className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-background hover:bg-accent-strong"
                    >
                      {w.h.soort === "wis" ? "Wissen in het register" : "Opslaan"}
                    </button>
                    <button type="button" onClick={() => setWachtrij((q) => q.filter((x) => x.id !== w.id))} className="text-sm text-muted hover:underline">
                      Weg
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted">{w.status === "bezig" ? "bezig…" : "opgeslagen"}</span>
                )}
                {w.melding && <span className={`w-full text-xs ${w.status === "fout" ? "text-red-700" : "text-muted"}`}>{w.melding}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * What a model element is as the source of a line (bronSoort, ModelelementSoort): an entity or a
 * gegevenselement by its own id; a field by the element it belongs to, the field in the naampad
 * (the enum has no value for a field, INRICHTEN_VIZ 25-11-2026).
 */
function bronVan(knoop: ModelKnoop, ouder: ModelKnoop | undefined, naampad: string) {
  if (knoop.soort === "entiteit" || knoop.soort === "gegevenselement") return { bronSoort: knoop.soort, bronElementId: knoop.id, naampad };
  if (knoop.soort === "veld" && ouder && (ouder.soort === "entiteit" || ouder.soort === "gegevenselement"))
    return { bronSoort: ouder.soort, bronElementId: ouder.id, naampad };
  return undefined;
}

function Knoop({
  knoop,
  licht,
  wijsAan,
  onWijs,
  pad,
  onTrek,
  ouder,
  diepte = 0,
}: {
  knoop: ModelKnoop;
  licht: Set<string>;
  wijsAan: Set<string>;
  onWijs: (w: Wijs) => void;
  pad: string[];
  onTrek?: (e: React.PointerEvent, knoop: ModelKnoop, bron: { bronSoort: string; bronElementId: string; naampad: string }) => void;
  ouder?: ModelKnoop;
  diepte?: number;
}) {
  const naampad = [...pad, knoop.label].join(".");
  const bron = bronVan(knoop, ouder, naampad);
  const aan = licht.has(knoop.id) || knoop.kinderen.some((c) => licht.has(c.id));
  const binnen = (n: ModelKnoop): boolean => licht.has(n.id) || n.kinderen.some(binnen);
  const open = diepte === 0 ? binnen(knoop) : aan;
  const label = (
    <span
      data-anker={knoop.id}
      data-soort={knoop.soort}
      data-naampad={bron?.naampad}
      data-bron-soort={onTrek ? bron?.bronSoort : undefined}
      data-bron-id={onTrek ? bron?.bronElementId : undefined}
      onMouseEnter={() => onWijs({ anker: knoop.id })}
      className={aan ? "rounded bg-accent/15 px-1 font-medium" : wijsAan.has(knoop.id) ? "rounded bg-accent/10 px-1" : ""}
    >
      {knoop.href ? <a href={knoop.href} className="hover:underline">{knoop.label}</a> : knoop.label}
      {knoop.soort !== "veld" && knoop.soort !== "domein" && knoop.soort !== "groep" && <span className="ml-1 text-xs text-muted">{knoop.soort}</span>}
      {onTrek && bron && (
        <button
          type="button"
          aria-label={`Lijn trekken vanaf ${knoop.label}`}
          title="Sleep naar een doel om een koppeling te leggen"
          onPointerDown={(e) => onTrek(e, knoop, bron)}
          onClick={(e) => e.preventDefault()}
          className="ml-1 inline-block h-3 w-3 cursor-grab touch-none rounded-full border-2 border-accent align-middle hover:bg-accent"
        />
      )}
    </span>
  );
  if (!knoop.kinderen.length) return <li style={{ paddingLeft: diepte ? 4 : 0 }}>{label}</li>;
  return (
    <li>
      <details open={open || undefined} key={String(open)}>
        <summary className="cursor-pointer">{label}</summary>
        <ul className="ml-4 space-y-1 border-l border-line pl-3">
          {knoop.kinderen.map((c) => (
            <Knoop key={c.id} knoop={c} licht={licht} wijsAan={wijsAan} onWijs={onWijs} pad={knoop.soort === "domein" || knoop.soort === "groep" ? [knoop.label] : [...pad, knoop.label]} onTrek={onTrek} ouder={knoop} diepte={diepte + 1} />
          ))}
        </ul>
      </details>
    </li>
  );
}
