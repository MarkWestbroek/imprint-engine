"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Teksten } from "./i18n";
import { Uitspreken } from "./uitspreken";
import {
  aanwijzend,
  lidwoord,
  zoek,
  type Naamwoord,
  type PoolseTreffer,
  type PoolsNaamwoord,
  type PoolsWerkwoord,
  type Treffer,
  type LijstBeelden,
  type Werkwoord,
  type Woordenlijst,
} from "./woorden";

type Labels = Teksten["woorden"] & { uitspreken: string };
type Props = {
  lijst: Woordenlijst;
  labels: Labels;
  /** Links to the grammar topics, if the package has them: present tense, articles (Polish: the cases). */
  meer?: { werkwoord?: { href: string; titel: string }; naamwoord?: { href: string; titel: string } };
};

const PERSONEN = ["ik", "jij", "hij / zij", "wij / jullie / zij"];
const OSOBY = ["ja", "ty", "on / ona", "my", "wy", "oni / one"];

/**
 * The picture(s) of a word, if it has any: one, or two for two meanings
 * (bank 🏦 🛋). Decorative for a screen reader: the word is said beside it.
 */
function Beeld({ woord, beelden, klein = false }: { woord: string; beelden?: LijstBeelden; klein?: boolean }) {
  const codes = beelden?.woorden[woord];
  if (!codes) return null;
  const maat = klein ? "h-5 w-5" : "h-16 w-16 sm:h-20 sm:w-20";
  return (
    <span className={`inline-flex shrink-0 ${klein ? "gap-0.5" : "gap-3"}`} aria-hidden>
      {codes.map((code) => (
        // eslint-disable-next-line @next/next/no-img-element -- a small static SVG from public/, no optimisation to gain
        <img key={code} src={`${beelden!.pad}${code}.svg`} alt="" width={klein ? 20 : 80} height={klein ? 20 : 80} loading="lazy" className={maat} />
      ))}
    </span>
  );
}

/** Says `tekst`; shows `toon` if given (the form alone, said with its person: "ik loop"). */
function Zeg({ tekst, toon, taal, label }: { tekst: string; toon?: string; taal: string; label: string }) {
  return (
    <Uitspreken text={tekst} lang={taal} label={label}>
      {toon ?? tekst}
    </Uitspreken>
  );
}

function NaamwoordKaart({ w, taal, labels, beelden }: { w: Naamwoord; taal: string; labels: Labels; beelden?: LijstBeelden }) {
  // Only the usual article: Wiktionary's second gender is often Flemish or old (het school), and would mislead.
  const { hoofd } = lidwoord(w.g);
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-3xl">
          <Zeg tekst={`${hoofd} ${w.w}`} taal={taal} label={labels.uitspreken} />
        </p>
        <Beeld woord={w.w} beelden={beelden} />
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-muted">{labels.meervoud}</dt>
        <dd lang={taal}>
          {w.mv.length === 0 ? (
            <span className="text-muted">{labels.geenMeervoud}</span>
          ) : (
            w.mv.map((m, i) => (
              <span key={m}>
                {i > 0 && ", "}
                <Zeg tekst={`de ${m}`} taal={taal} label={labels.uitspreken} />
              </span>
            ))
          )}
        </dd>
        {w.vk && (
          <>
            <dt className="text-muted">{labels.verkleinwoord}</dt>
            <dd lang={taal}>
              <Zeg tekst={`het ${w.vk}`} taal={taal} label={labels.uitspreken} />
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

function WerkwoordKaart({ w, taal, labels, beelden }: { w: Werkwoord; taal: string; labels: Labels; beelden?: LijstBeelden }) {
  const hulp = { hebben: ["heb"], zijn: ["ben"], beide: ["heb", "ben"] }[w.hulp];
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-3xl">
          <Zeg tekst={w.w} taal={taal} label={labels.uitspreken} />
          <span className="ml-3 text-base text-muted">{w.sterk ? labels.onregelmatig : labels.regelmatig}</span>
        </p>
        <Beeld woord={w.w} beelden={beelden} />
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="eyebrow mb-2">{labels.tt}</h3>
          <table className="w-full text-left" lang={taal}>
            <tbody>
              {w.tt.map((vorm, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-1 pr-4 text-muted">{PERSONEN[i]}</td>
                  <td className="py-1">
                    <Zeg tekst={`${PERSONEN[i]!.split(" / ")[0]} ${vorm}`} toon={vorm} taal={taal} label={labels.uitspreken} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="eyebrow mb-2">{labels.vt}</h3>
          <p lang={taal}>
            <Zeg tekst={`ik ${w.vt[0]}`} taal={taal} label={labels.uitspreken} />
            {" · "}
            <Zeg tekst={`wij ${w.vt[1]}`} taal={taal} label={labels.uitspreken} />
          </p>
          <h3 className="eyebrow mt-4 mb-2">{labels.vd}</h3>
          <p lang={taal}>
            {hulp.map((h, i) => (
              <span key={h}>
                {i > 0 && " / "}
                <Zeg tekst={`ik ${h} ${w.vd}`} taal={taal} label={labels.uitspreken} />
              </span>
            ))}
          </p>
          <p className="mt-1 text-sm text-muted">{labels.hulp[w.hulp]}</p>
        </section>
      </div>
    </div>
  );
}

/** What a word means, in English: Wiktionary's gloss, the only translation the list has. */
function Betekenis({ b, label }: { b?: string; label: string }) {
  if (!b) return null;
  return (
    <p className="mt-1 text-muted" lang="en">
      <span className="text-sm">{label}</span> {b}
    </p>
  );
}

/** A Polish noun: "this" for its gender (ten sklep), and the seven cases in both numbers. */
function PoolsNaamwoordKaart({ w, labels, beelden }: { w: PoolsNaamwoord; labels: Labels; beelden?: LijstBeelden }) {
  const p = labels.pools;
  const dit = aanwijzend(w.g);
  const kop = w.ev[0] ?? w.mv[0]!;
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-3xl">
            <Zeg tekst={`${dit} ${kop}`} taal="pl" label={labels.uitspreken} />
            <span className="ml-3 text-base text-muted">{p.geslacht[w.g]}</span>
          </p>
          <Betekenis b={w.b} label={p.betekenis} />
        </div>
        <Beeld woord={w.w} beelden={beelden} />
      </div>
      <table className="mt-4 w-full text-left">
        <thead>
          <tr className="border-b border-line text-sm text-muted">
            <th className="py-1 pr-4 font-normal">{p.naamval}</th>
            {w.ev.length > 0 && <th className="py-1 pr-4 font-normal">{p.enkelvoud}</th>}
            {w.mv.length > 0 && <th className="py-1 font-normal">{p.meervoud}</th>}
          </tr>
        </thead>
        <tbody>
          {p.naamvallen.map((naam, i) => (
            <tr key={naam} className="border-b border-line last:border-0">
              <td className="py-1 pr-4 text-muted">{naam}</td>
              {w.ev.length > 0 && (
                <td className="py-1 pr-4" lang="pl">
                  <Zeg tekst={w.ev[i]!} taal="pl" label={labels.uitspreken} />
                </td>
              )}
              {w.mv.length > 0 && (
                <td className="py-1" lang="pl">
                  <Zeg tekst={w.mv[i]!} taal="pl" label={labels.uitspreken} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A Polish verb: its aspect and its partner, the forms without a helper, and the past for a man and a woman. */
function PoolsWerkwoordKaart({ w, labels, beelden, onZoek }: { w: PoolsWerkwoord; labels: Labels; beelden?: LijstBeelden; onZoek: (woord: string) => void }) {
  const p = labels.pools;
  const sie = w.sie ? " się" : "";
  const zeg = (persoon: string, vorm: string) => <Zeg tekst={`${persoon} ${vorm}${sie}`} toon={`${vorm}${sie}`} taal="pl" label={labels.uitspreken} />;
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-3xl">
            <Zeg tekst={`${w.w}${sie}`} taal="pl" label={labels.uitspreken} />
            <span className="ml-3 text-base text-muted">{p.aspect[w.asp]}</span>
          </p>
          <Betekenis b={w.b} label={p.betekenis} />
        </div>
        <Beeld woord={w.w} beelden={beelden} />
      </div>
      {w.paar.length > 0 && (
        <p className="mt-1 text-muted">
          <span className="text-sm">{p.paar[w.asp]}</span>{" "}
          {w.paar.map((partner, i) => (
            <span key={partner}>
              {i > 0 && ", "}
              <button type="button" lang="pl" onClick={() => onZoek(partner)} className="font-semibold text-accent hover:underline">
                {partner}
              </button>
            </span>
          ))}
        </p>
      )}
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <section>
          {/* Without a helper a perfective verb speaks of the future: zrobię = I will do. */}
          <h3 className="eyebrow mb-2">{w.asp === "dk" ? p.toekomst : p.tt}</h3>
          <table className="w-full text-left" lang="pl">
            <tbody>
              {w.tt.map((vorm, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-1 pr-4 text-muted">{OSOBY[i]}</td>
                  <td className="py-1">{zeg(OSOBY[i]!.split(" / ")[0]!, vorm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="eyebrow mb-2">{p.vt}</h3>
          <table className="w-full text-left" lang="pl">
            <tbody>
              {(
                [
                  ["ja", w.vt[0], w.vt[1]],
                  ["on / ona", w.vt[2], w.vt[3]],
                  ["oni / one", w.vt[4], w.vt[5]],
                ] as const
              ).map(([wie, man, vrouw]) => {
                const [hij, zij] = wie === "ja" ? ["ja", "ja"] : wie.split(" / ");
                return (
                  <tr key={wie} className="border-b border-line last:border-0">
                    <td className="py-1 pr-4 text-muted">{wie}</td>
                    <td className="py-1">
                      {zeg(hij!, man)} / {zeg(zij!, vrouw)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

/** One line in the suggestions: enough to recognise the word, and often the answer already. */
function regel(t: Treffer): string {
  if (t.soort === "naamwoord") {
    const { hoofd } = lidwoord(t.woord.g);
    return `${hoofd} ${t.woord.w}${t.woord.mv[0] ? ` · de ${t.woord.mv[0]}` : ""}`;
  }
  return `${t.woord.w} · ${t.woord.vt[0]} · ${t.woord.hulp === "zijn" ? "is" : t.woord.hulp === "beide" ? "heeft/is" : "heeft"} ${t.woord.vd}`;
}

function poolseRegel(t: PoolseTreffer): string {
  if (t.soort === "naamwoord") return `${aanwijzend(t.woord.g)} ${t.woord.ev[0] ?? t.woord.mv[0]}${t.woord.b ? ` · ${t.woord.b}` : ""}`;
  return `${t.woord.w}${t.woord.sie ? " się" : ""} · ${t.woord.tt[0]}${t.woord.b ? ` · ${t.woord.b}` : ""}`;
}

/**
 * "Check a word": type a noun or verb of the language taught and see its
 * forms. Dutch: article, plural, the verb's forms. Polish: gender and cases,
 * aspect and forms; any form finds its word. The list comes as a prop
 * (prerendered with the page); the searching is done here, in the browser, as
 * you type.
 */
export function Woordzoeker({ lijst, labels, meer }: Props) {
  const [invoer, setInvoer] = useState("");
  const [gekozen, setGekozen] = useState(0);
  const lijstId = useId();
  const taal = lijst.taal;
  const treffers = useMemo(
    () =>
      lijst.taal === "pl"
        ? zoek(lijst, invoer).map((t) => ({ taal: "pl" as const, t, key: `${t.soort}-${t.woord.w}`, regel: poolseRegel(t) }))
        : zoek(lijst, invoer).map((t) => ({ taal: "nl" as const, t, key: `${t.soort}-${t.woord.w}`, regel: regel(t) })),
    [lijst, invoer],
  );
  const kaart = treffers[Math.min(gekozen, treffers.length - 1)];
  const link = kaart && meer?.[kaart.t.soort];
  const zoekWoord = (woord: string) => {
    setInvoer(woord);
    setGekozen(0);
  };

  return (
    <div>
      <label className="block">
        <span className="sr-only">{labels.zoek}</span>
        <input
          type="search"
          value={invoer}
          lang={taal}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={taal === "pl" ? labels.pools.voorbeeld : labels.voorbeeld}
          aria-controls={lijstId}
          onChange={(e) => zoekWoord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setGekozen((g) => Math.min(g + 1, treffers.length - 1));
            if (e.key === "ArrowUp") setGekozen((g) => Math.max(g - 1, 0));
          }}
          className="w-full rounded-md border border-line bg-background px-4 py-3 text-xl focus:border-accent focus:outline-none"
        />
      </label>

      {invoer.trim() && treffers.length === 0 && <p className="mt-4 text-muted">{labels.geen}</p>}

      {treffers.length > 1 && (
        <ul id={lijstId} className="mt-3 flex flex-wrap gap-2" aria-label={labels.suggesties}>
          {treffers.map((x, i) => (
            <li key={x.key}>
              <button
                type="button"
                aria-pressed={i === gekozen}
                onClick={() => setGekozen(i)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${i === gekozen ? "border-accent bg-accent text-background" : "border-line hover:border-accent"}`}
              >
                <Beeld woord={x.t.woord.w} beelden={lijst.beelden} klein />
                {x.regel}
              </button>
            </li>
          ))}
        </ul>
      )}

      {kaart && (
        <section className="mt-6 rounded-md border border-line bg-surface p-5" aria-live="polite">
          <p className="eyebrow mb-2">{kaart.t.soort === "naamwoord" ? labels.naamwoord : labels.werkwoord}</p>
          {kaart.taal === "pl" ? (
            kaart.t.soort === "naamwoord" ? (
              <PoolsNaamwoordKaart w={kaart.t.woord} labels={labels} beelden={lijst.beelden} />
            ) : (
              <PoolsWerkwoordKaart w={kaart.t.woord} labels={labels} beelden={lijst.beelden} onZoek={zoekWoord} />
            )
          ) : kaart.t.soort === "naamwoord" ? (
            <NaamwoordKaart w={kaart.t.woord} taal={taal} labels={labels} beelden={lijst.beelden} />
          ) : (
            <WerkwoordKaart w={kaart.t.woord} taal={taal} labels={labels} beelden={lijst.beelden} />
          )}
          {link && (
            <p className="mt-4 text-sm">
              <Link href={link.href} className="font-semibold text-accent hover:underline">
                {link.titel} →
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
