"use client";

import { useMemo, useState } from "react";
import { ActieFout, beschrijf, nieuweSleutel, pasToe, type FormulierActie, type ModelVeld } from "./formulier-acties";
import { FormPreview } from "./form-preview";
import type { NeutralForm, Question } from "./neutral-form";

/**
 * The form of the werkplaats, editable in the browser (Fase B, laag 1, Mark
 * 10-11-2026): every change is a `FormulierActie`, applied with `pasToe`; the
 * preview follows at once; the list on the right is what would become ops on
 * the dienst's branch. Nothing is saved — leaving the page forgets it. Laag 2
 * sends the same actions to server actions.
 */

export type Beschikbaar = ModelVeld & { entiteit: string; pad?: string };

const btn = "rounded border border-line px-1.5 py-0.5 text-xs leading-none hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";

export function FormEditor({
  form: start,
  velden: veldenObj,
  beschikbaar,
}: {
  form: NeutralForm;
  /** The model's fields per element (`modelVelden`), as a plain object for the client. */
  velden: Record<string, ModelVeld[]>;
  /** The fields the model has and the form does not ask (yet). */
  beschikbaar: Beschikbaar[];
}) {
  const velden = useMemo(() => new Map(Object.entries(veldenObj)), [veldenObj]);
  const [acties, setActies] = useState<FormulierActie[]>([]);
  const [fout, setFout] = useState("");
  const [gekozen, setGekozen] = useState<string | undefined>();

  // The form is the start plus the actions: undo is dropping the last one.
  const form = useMemo(() => acties.reduce((f, a) => pasToe(f, a, velden), start), [acties, start, velden]);
  const inForm = new Set(form.steps.flatMap((st) => st.questions.map((q) => `${q.bron?.elementId}|${q.bron?.veld}`)));
  const vrij = beschikbaar.filter((b) => !inForm.has(`${b.elementId}|${b.veld}`));
  const vragen = form.steps.flatMap((st) => st.questions);

  function doe(a: FormulierActie) {
    try {
      pasToe(form, a, velden); // check first: a refused action is not recorded
      setActies((list) => [...list, a]);
      setFout("");
    } catch (e) {
      setFout(e instanceof ActieFout ? e.message : String(e));
    }
  }
  const modelVerplicht = (q: Question) => Boolean(q.bron?.elementId && velden.get(q.bron.elementId)?.find((v) => v.veld === q.bron?.veld)?.verplicht);

  return (
    <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
      <section className="min-w-0 space-y-4 p-4 text-sm">
        <h2 className="font-semibold">Velden en vragen</h2>
        {fout && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 px-2 py-1 text-red-900">
            {fout}
          </p>
        )}
        {form.steps.map((st, s) => (
          <section key={st.slug ?? s}>
            <StapKop titel={st.title} n={s + 1} onHernoem={(titel) => st.slug && doe({ actie: "stapHernoemen", stap: st.slug, titel })} />
            <ul className="divide-y divide-line/60 rounded-lg border border-line bg-white">
              {st.questions.length === 0 && <li className="p-2 text-xs text-muted">Nog geen vragen in deze stap.</li>}
              {st.questions.map((q, i) => (
                <VraagRij
                  key={q.key}
                  q={q}
                  sel={q.key === gekozen}
                  onKies={() => setGekozen(q.key)}
                  modelVerplicht={modelVerplicht(q)}
                  vragen={vragen.filter((x) => x.key !== q.key)}
                  stappen={form.steps}
                  stap={st.slug ?? ""}
                  omhoog={i > 0 ? () => doe({ actie: "vraagVerplaatsen", vraag: q.key, stap: st.slug!, na: i >= 2 ? st.questions[i - 2]!.key : null }) : undefined}
                  omlaag={i < st.questions.length - 1 ? () => doe({ actie: "vraagVerplaatsen", vraag: q.key, stap: st.slug!, na: st.questions[i + 1]!.key }) : undefined}
                  doe={doe}
                />
              ))}
            </ul>
            {st.slug && (
              <Toevoegen
                vrij={vrij}
                onKies={(b) => {
                  const key = nieuweSleutel(form, b.veld, b.ge, b.entiteit);
                  doe({
                    actie: "vraagToevoegen",
                    stap: st.slug!,
                    na: st.questions.at(-1)?.key ?? null,
                    vraag: key,
                    label: b.veld, // the default label is the field name (§5.11): the model has no labels
                    type: b.type,
                    bron: { elementId: b.elementId, veld: b.veld, pad: b.pad },
                  });
                  setGekozen(key);
                }}
              />
            )}
          </section>
        ))}
        <NieuweStap
          onVoegToe={(titel) => {
            const slug = titel.toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "stap";
            doe({ actie: "stapToevoegen", stap: slug, titel, na: form.steps.at(-1)?.slug ?? null });
          }}
        />
      </section>

      <section className="min-w-0 space-y-4 border-line p-4 lg:border-l">
        <h2 className="flex items-baseline justify-between gap-2 font-semibold">
          Effect <small className="text-xs font-normal text-muted">{acties.length ? "gewijzigd, nog niet gegenereerd" : "zoals gegenereerd"}</small>
        </h2>
        <FormPreview key={acties.length} form={form} highlight={gekozen} />
        <section className="rounded-lg border border-line bg-white p-3 text-sm">
          <h3 className="font-medium">
            Wijzigingen <span className="text-muted">({acties.length})</span>
          </h3>
          {acties.length === 0 ? (
            <p className="mt-1 text-xs text-muted">Nog niets gewijzigd. Elke wijziging komt hier, en wordt straks één bewerking op het model van deze dienst.</p>
          ) : (
            <>
              <ol className="mt-1 list-decimal space-y-0.5 break-words pl-5 text-xs">
                {acties.map((a, n) => (
                  <li key={n}>{beschrijf(a)}</li>
                ))}
              </ol>
              <div className="mt-2 flex gap-2">
                <button type="button" className={btn} onClick={() => setActies((l) => l.slice(0, -1))}>
                  Laatste ongedaan maken
                </button>
                <button type="button" className={btn} onClick={() => setActies([])}>
                  Alles terug
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">Niet opgeslagen: verlaat je de pagina, dan zijn deze wijzigingen weg.</p>
            </>
          )}
        </section>
      </section>
    </div>
  );
}

function StapKop({ titel, n, onHernoem }: { titel: string; n: number; onHernoem: (t: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(titel);
  return (
    <h3 className="mb-1 flex items-center gap-2 font-medium">
      {n}.{" "}
      {edit ? (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.trim() && v !== titel) onHernoem(v.trim());
            setEdit(false);
          }}
        >
          <input aria-label="Naam van de stap" className="rounded border border-line px-1" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          <button className={btn}>OK</button>
        </form>
      ) : (
        <>
          {titel}
          <button type="button" className={btn} aria-label={`Stap ${titel} hernoemen`} onClick={() => (setV(titel), setEdit(true))}>
            ✎
          </button>
        </>
      )}
    </h3>
  );
}

function VraagRij({
  q,
  sel,
  onKies,
  modelVerplicht,
  vragen,
  stappen,
  stap,
  omhoog,
  omlaag,
  doe,
}: {
  q: Question;
  sel: boolean;
  onKies: () => void;
  modelVerplicht: boolean;
  vragen: Question[];
  stappen: NeutralForm["steps"];
  stap: string;
  omhoog?: () => void;
  omlaag?: () => void;
  doe: (a: FormulierActie) => void;
}) {
  const [label, setLabel] = useState<string | undefined>();
  const [cond, setCond] = useState<{ vraag: string; gelijkAan: string } | undefined>();
  const bron = vragen.find((x) => x.key === cond?.vraag);
  return (
    <li className={`space-y-1 p-2 ${sel ? "bg-yellow-50" : ""}`} onFocus={onKies} onClick={onKies}>
      <div className="flex flex-wrap items-center gap-1.5">
        {label === undefined ? (
          <>
            <span className="font-medium">{q.label || q.key}</span>
            <button type="button" className={btn} aria-label={`Label van ${q.key} wijzigen`} onClick={() => setLabel(q.label)}>
              ✎
            </button>
          </>
        ) : (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (label.trim() && label !== q.label) doe({ actie: "labelWijzigen", vraag: q.key, label: label.trim() });
              setLabel(undefined);
            }}
          >
            <input aria-label="Label" className="w-64 rounded border border-line px-1" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
            <button className={btn}>OK</button>
          </form>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className={btn} aria-label={`${q.key} omhoog`} disabled={!omhoog} onClick={omhoog}>
            ↑
          </button>
          <button type="button" className={btn} aria-label={`${q.key} omlaag`} disabled={!omlaag} onClick={omlaag}>
            ↓
          </button>
          <select
            aria-label={`${q.key} naar een andere stap`}
            className="rounded border border-line text-xs"
            value=""
            onChange={(e) => {
              const st = stappen.find((x) => x.slug === e.target.value);
              if (st) doe({ actie: "vraagVerplaatsen", vraag: q.key, stap: st.slug!, na: st.questions.at(-1)?.key ?? null });
            }}
          >
            <option value="">naar stap…</option>
            {stappen
              .filter((x) => x.slug && x.slug !== stap)
              .map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.title}
                </option>
              ))}
          </select>
          <button
            type="button"
            className={btn}
            aria-label={`${q.key} weglaten`}
            disabled={modelVerplicht}
            title={modelVerplicht ? "Verplicht in het model: weglaten kan alleen met een vaste waarde" : "Weglaten uit het formulier"}
            onClick={() => doe({ actie: "vraagVerwijderen", vraag: q.key })}
          >
            ✕
          </button>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <code>{q.key}</code>
        {q.bron?.pad && <span>uit {q.bron.pad.split(".").slice(-2).join(".")}</span>}
        <label className="flex items-center gap-1" title={modelVerplicht ? "Verplicht in het model; dat kan de dienst niet opheffen" : undefined}>
          <input
            type="checkbox"
            checked={q.required}
            disabled={modelVerplicht && q.required}
            onChange={(e) => doe({ actie: "verplichtZetten", vraag: q.key, verplicht: e.target.checked })}
          />
          verplicht{modelVerplicht && " (model)"}
        </label>
        {q.condition && !cond && (
          <span>
            alleen als {q.condition.key} = {q.condition.eq}{" "}
            <button type="button" className={btn} onClick={() => doe({ actie: "voorwaardeZetten", vraag: q.key, voorwaarde: null })}>
              voorwaarde weg
            </button>
          </span>
        )}
        {!cond ? (
          <button type="button" className={btn} onClick={() => setCond({ vraag: q.condition?.key ?? "", gelijkAan: q.condition?.eq ?? "" })}>
            {q.condition ? "voorwaarde wijzigen" : "+ voorwaarde"}
          </button>
        ) : (
          <form
            className="flex flex-wrap items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (cond.vraag) doe({ actie: "voorwaardeZetten", vraag: q.key, voorwaarde: { vraag: cond.vraag, gelijkAan: cond.gelijkAan } });
              setCond(undefined);
            }}
          >
            alleen als
            <select aria-label="Vraag van de voorwaarde" className="rounded border border-line" value={cond.vraag} onChange={(e) => setCond({ vraag: e.target.value, gelijkAan: "" })}>
              <option value="">kies een vraag…</option>
              {vragen
                .filter((x) => x.type !== "group" && x.type !== "content")
                .map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label || x.key}
                  </option>
                ))}
            </select>
            =
            {bron?.type === "checkbox" ? (
              <select aria-label="Waarde" className="rounded border border-line" value={cond.gelijkAan} onChange={(e) => setCond({ ...cond, gelijkAan: e.target.value })}>
                <option value="">…</option>
                <option value="true">aangevinkt</option>
                <option value="false">niet aangevinkt</option>
              </select>
            ) : bron?.choices.length ? (
              <select aria-label="Waarde" className="rounded border border-line" value={cond.gelijkAan} onChange={(e) => setCond({ ...cond, gelijkAan: e.target.value })}>
                <option value="">…</option>
                {bron.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <input aria-label="Waarde" className="w-28 rounded border border-line px-1" value={cond.gelijkAan} onChange={(e) => setCond({ ...cond, gelijkAan: e.target.value })} />
            )}
            <button className={btn} disabled={!cond.vraag || !cond.gelijkAan}>
              OK
            </button>
            <button type="button" className={btn} onClick={() => setCond(undefined)}>
              annuleer
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function Toevoegen({ vrij, onKies }: { vrij: Beschikbaar[]; onKies: (b: Beschikbaar) => void }) {
  if (!vrij.length) return null;
  const groepen = new Map<string, Beschikbaar[]>();
  for (const b of vrij) groepen.set(`${b.entiteit} › ${b.ge}`, [...(groepen.get(`${b.entiteit} › ${b.ge}`) ?? []), b]);
  return (
    <select
      aria-label="Vraag toevoegen uit het model"
      className="mt-1 block w-full max-w-full rounded border border-dashed border-line bg-white px-1 py-0.5 text-xs text-muted"
      value=""
      onChange={(e) => {
        const b = vrij[Number(e.target.value)];
        if (b) onKies(b);
      }}
    >
      <option value="">+ vraag uit het model…</option>
      {[...groepen].map(([g, list]) => (
        <optgroup key={g} label={g}>
          {list.map((b) => (
            <option key={`${b.elementId}|${b.veld}`} value={vrij.indexOf(b)}>
              {b.veld} ({b.soort}
              {b.verplicht ? ", verplicht in het model" : ""})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function NieuweStap({ onVoegToe }: { onVoegToe: (titel: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-1 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onVoegToe(v.trim());
        setV("");
      }}
    >
      <input aria-label="Naam van een nieuwe stap" placeholder="Nieuwe stap…" className="rounded border border-dashed border-line px-1" value={v} onChange={(e) => setV(e.target.value)} />
      <button className={btn} disabled={!v.trim()}>
        + stap
      </button>
    </form>
  );
}
