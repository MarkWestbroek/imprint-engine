"use client";

import { useEffect, useMemo, useState } from "react";
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

/** Step 5: model left, targets right, the existing links between them; choosing a link lights up both sides. */
export function KoppelingenScherm({ model, doelen, koppelingen }: { model: ModelKnoop[]; doelen: Doel[]; koppelingen: Koppeling[] }) {
  const [gekozen, setGekozen] = useState<string | undefined>(koppelingen.find((k) => doelen.some((d) => d.draaitHier && d.component === k.doel.component))?.id);
  const k = koppelingen.find((x) => x.id === gekozen);
  const licht = useMemo(() => new Set(k?.bron.ids ?? []), [k]);
  const perDoel = useMemo(() => {
    const m = new Map<string, Koppeling[]>();
    for (const x of koppelingen) m.set(x.doel.component, [...(m.get(x.doel.component) ?? []), x]);
    return m;
  }, [koppelingen]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <section aria-label="Model" className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Model</h3>
        <ul className="space-y-1 text-sm">
          {model.map((n) => (
            <Knoop key={n.id} knoop={n} licht={licht} />
          ))}
        </ul>
      </section>
      <section aria-label="Doelen" className="rounded-xl border border-line bg-surface p-4">
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
                      onClick={() => setGekozen(x.id)}
                      aria-pressed={x.id === gekozen}
                      className={`text-left hover:underline ${x.id === gekozen ? "font-semibold text-accent" : ""}`}
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
      <section aria-label="Gekozen koppeling" className="rounded-xl border border-line bg-surface p-4 text-sm lg:col-span-2" aria-live="polite">
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
          <p className="text-muted">Kies rechts een koppeling: links lichten de modelelementen op die ze leest.</p>
        )}
      </section>
    </div>
  );
}

function Knoop({ knoop, licht, diepte = 0 }: { knoop: ModelKnoop; licht: Set<string>; diepte?: number }) {
  const aan = licht.has(knoop.id) || knoop.kinderen.some((c) => licht.has(c.id));
  const binnen = (n: ModelKnoop): boolean => licht.has(n.id) || n.kinderen.some(binnen);
  const open = diepte === 0 ? binnen(knoop) : aan;
  const label = (
    <span className={aan ? "rounded bg-accent/15 px-1 font-medium" : ""}>
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
            <Knoop key={c.id} knoop={c} licht={licht} diepte={diepte + 1} />
          ))}
        </ul>
      </details>
    </li>
  );
}
