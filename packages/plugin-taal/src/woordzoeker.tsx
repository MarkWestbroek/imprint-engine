"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Teksten } from "./i18n";
import { Uitspreken } from "./uitspreken";
import { lidwoord, zoek, type Naamwoord, type Treffer, type Werkwoord, type Woordenlijst } from "./woorden";

type Labels = Teksten["woorden"] & { uitspreken: string };
type Props = {
  lijst: Woordenlijst;
  labels: Labels;
  /** Links to the grammar topics, if the package has them: present tense, articles. */
  meer?: { werkwoord?: { href: string; titel: string }; naamwoord?: { href: string; titel: string } };
};

const PERSONEN = ["ik", "jij", "hij / zij", "wij / jullie / zij"];

/** Says `tekst`; shows `toon` if given (the form alone, said with its person: "ik loop"). */
function Zeg({ tekst, toon, taal, label }: { tekst: string; toon?: string; taal: string; label: string }) {
  return (
    <Uitspreken text={tekst} lang={taal} label={label}>
      {toon ?? tekst}
    </Uitspreken>
  );
}

function NaamwoordKaart({ w, taal, labels }: { w: Naamwoord; taal: string; labels: Labels }) {
  // Only the usual article: Wiktionary's second gender is often Flemish or old (het school), and would mislead.
  const { hoofd } = lidwoord(w.g);
  return (
    <div>
      <p className="text-3xl">
        <Zeg tekst={`${hoofd} ${w.w}`} taal={taal} label={labels.uitspreken} />
      </p>
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

function WerkwoordKaart({ w, taal, labels }: { w: Werkwoord; taal: string; labels: Labels }) {
  const hulp = { hebben: ["heb"], zijn: ["ben"], beide: ["heb", "ben"] }[w.hulp];
  return (
    <div>
      <p className="text-3xl">
        <Zeg tekst={w.w} taal={taal} label={labels.uitspreken} />
        <span className="ml-3 text-base text-muted">{w.sterk ? labels.onregelmatig : labels.regelmatig}</span>
      </p>
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

/** One line in the suggestions: enough to recognise the word, and often the answer already. */
function regel(t: Treffer): string {
  if (t.soort === "naamwoord") {
    const { hoofd } = lidwoord(t.woord.g);
    return `${hoofd} ${t.woord.w}${t.woord.mv[0] ? ` · de ${t.woord.mv[0]}` : ""}`;
  }
  return `${t.woord.w} · ${t.woord.vt[0]} · ${t.woord.hulp === "zijn" ? "is" : t.woord.hulp === "beide" ? "heeft/is" : "heeft"} ${t.woord.vd}`;
}

/**
 * "Check a word": type a Dutch noun or verb and see its article, plural and
 * forms. The list comes as a prop (prerendered with the page); the searching
 * is done here, in the browser, as you type.
 */
export function Woordzoeker({ lijst, labels, meer }: Props) {
  const [invoer, setInvoer] = useState("");
  const [gekozen, setGekozen] = useState(0);
  const lijstId = useId();
  const treffers = useMemo(() => zoek(lijst, invoer), [lijst, invoer]);
  const kaart = treffers[Math.min(gekozen, treffers.length - 1)];
  const taal = lijst.taal;
  const link = kaart && meer?.[kaart.soort];

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
          placeholder={labels.voorbeeld}
          aria-controls={lijstId}
          onChange={(e) => {
            setInvoer(e.target.value);
            setGekozen(0);
          }}
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
          {treffers.map((t, i) => (
            <li key={`${t.soort}-${t.woord.w}`}>
              <button
                type="button"
                lang={taal}
                aria-pressed={i === gekozen}
                onClick={() => setGekozen(i)}
                className={`rounded-full border px-3 py-1 text-sm ${i === gekozen ? "border-accent bg-accent text-background" : "border-line hover:border-accent"}`}
              >
                {regel(t)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {kaart && (
        <section className="mt-6 rounded-md border border-line bg-surface p-5" aria-live="polite">
          <p className="eyebrow mb-2">{kaart.soort === "naamwoord" ? labels.naamwoord : labels.werkwoord}</p>
          {kaart.soort === "naamwoord" ? (
            <NaamwoordKaart w={kaart.woord} taal={taal} labels={labels} />
          ) : (
            <WerkwoordKaart w={kaart.woord} taal={taal} labels={labels} />
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
