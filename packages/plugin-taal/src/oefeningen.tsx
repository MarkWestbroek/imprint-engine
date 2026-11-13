"use client";

import { useEffect, useState } from "react";
import type { AudioKaart } from "./audio";
import type { Teksten } from "./i18n";
import type { Oefening } from "./schemas";
import { Speak } from "./speak";
import { localeOf, typGoed, vormen, woorden, zegGoed } from "./tekst";
import { useVorm } from "./vorm";

/**
 * The exercises of one lesson, one at a time (behaviour of the prototype,
 * design/taaltraining/prototype/Oefeningen.jsx): luister and kies (pick),
 * typ (translate and type), orden (words in order), zeg (say it aloud, three
 * tries). The score per lesson is kept in this browser (localStorage).
 *
 * Everything arrives as props from the server viewer: the exercises, the
 * recordings that exist and the interface texts.
 */

type Props = {
  lesId: string;
  /** The language being taught. */
  taal: string;
  oefeningen: Oefening[];
  audio: AudioKaart;
  t: Teksten;
};

/** `zelf`: the learner judged it (no speech recognition in this browser). */
type Done = (goed: boolean, zelf?: boolean) => void;
type Deel<T extends Oefening["type"]> = { o: Extract<Oefening, { type: T }>; taal: string; audio: AudioKaart; t: Teksten; onDone: Done };

export const VOORTGANG_KEY = "taal-voortgang";

function saveScore(id: string, score: number, total: number) {
  try {
    const all = JSON.parse(localStorage.getItem(VOORTGANG_KEY) ?? "{}") as Record<string, unknown>;
    all[id] = { score, total, datum: new Date().toISOString().slice(0, 10) };
    localStorage.setItem(VOORTGANG_KEY, JSON.stringify(all));
  } catch {
    // no storage (private mode): the score is just not kept
  }
}

const fill = (tekst: string, waarden: Record<string, string | number>) => tekst.replace(/\{(\w+)\}/g, (_, k: string) => String(waarden[k] ?? ""));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const optie = "rounded-md border border-line bg-background px-4 py-2 text-left hover:border-accent disabled:hover:border-line";
const primair = "rounded-md bg-accent px-4 py-2 font-semibold text-background hover:bg-accent-strong disabled:opacity-60";
const goedCls = "font-semibold text-accent";
const foutCls = "font-semibold text-foreground";

function zinSpeler(taal: string, audio: AudioKaart, t: Teksten) {
  return function Zin(text: string) {
    return <Speak text={text} lang={taal} audio={audio[`${taal}|${text}`]} labels={{ speel: t.speel, langzaam: t.langzaam }} />;
  };
}

function Kies({ o, taal, audio, t, onDone }: Omit<Deel<"kies">, "o"> & { o: Extract<Oefening, { type: "kies" | "luister" }> }) {
  const [gekozen, setGekozen] = useState<number | null>(null);
  const speak = zinSpeler(taal, audio, t);
  const vorm = useVorm();
  const klaar = gekozen !== null;
  return (
    <div className="space-y-4">
      {o.type === "luister" ? (
        <p>
          {t.luister}: {speak(o.tekst)}
        </p>
      ) : (
        <p lang={taal}>{vormen(o.vraag, vorm)}</p>
      )}
      <div className="flex flex-col gap-2">
        {o.opties.map((opt, i) => {
          const mark = !klaar ? "" : i === o.antwoord ? " border-accent bg-surface font-semibold" : i === gekozen ? " line-through opacity-70" : " opacity-70";
          return (
            <button
              key={i}
              type="button"
              disabled={klaar}
              className={optie + mark}
              aria-pressed={i === gekozen}
              onClick={() => {
                setGekozen(i);
                onDone(i === o.antwoord);
              }}
            >
              {vormen(opt, vorm)}
              {klaar && i === o.antwoord && <span aria-hidden> ✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Typ({ o, taal, t, onDone }: Deel<"typ">) {
  const [invoer, setInvoer] = useState("");
  const [resultaat, setResultaat] = useState<boolean | null>(null);
  const vraag = vormen(o.vraag, useVorm());
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (resultaat !== null || !invoer.trim()) return;
        const goed = typGoed(invoer, o.antwoorden);
        setResultaat(goed);
        onDone(goed);
      }}
    >
      <p>
        {fill(t.zegIn, { taal: t.inTaal[taal] ?? taal })} <em>{vraag}</em>
      </p>
      <input
        value={invoer}
        onChange={(e) => setInvoer(e.target.value)}
        disabled={resultaat !== null}
        lang={taal}
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        aria-label={vraag}
        className="w-full rounded-md border border-line bg-background px-3 py-2"
      />
      {resultaat === null && (
        <button type="submit" className={primair}>
          {t.controleer}
        </button>
      )}
      {resultaat === true && <p className={goedCls}>{t.goed}</p>}
      {resultaat === false && (
        <p className={foutCls}>
          {t.bijvoorbeeld} <span lang={taal}>{o.antwoorden[0]}</span>
        </p>
      )}
    </form>
  );
}

function Orden({ o, taal, audio, t, onDone }: Deel<"orden">) {
  type Woord = { w: string; i: number };
  const alle = woorden(o.zin);
  // Shuffled once in the browser (an effect): the server and the first render show the same, empty pool.
  const [pool, setPool] = useState<Woord[] | null>(null);
  const [zin, setZin] = useState<Woord[]>([]);
  const [resultaat, setResultaat] = useState<boolean | null>(null);
  const speak = zinSpeler(taal, audio, t);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- random order must not differ between server and browser
    setPool(shuffle(woorden(o.zin).map((w, i) => ({ w, i }))));
  }, [o.zin]);

  const kies = (item: Woord) => {
    const nieuw = [...zin, item];
    setZin(nieuw);
    setPool((pool ?? []).filter((p) => p !== item));
    if (nieuw.length === alle.length) {
      const goed = nieuw.map((p) => p.w).join(" ") === alle.join(" ");
      setResultaat(goed);
      onDone(goed);
    }
  };
  const terug = (item: Woord) => {
    if (resultaat !== null) return;
    setZin(zin.filter((p) => p !== item));
    setPool([...(pool ?? []), item]);
  };

  return (
    <div className="space-y-4">
      <p>{t.zetOpVolgorde}</p>
      <div className="flex min-h-12 flex-wrap gap-2 rounded-md border border-dashed border-line p-2" lang={taal} aria-live="polite">
        {zin.map((p) => (
          <button key={p.i} type="button" className={optie} onClick={() => terug(p)} disabled={resultaat !== null}>
            {p.w}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" lang={taal}>
        {(pool ?? []).map((p) => (
          <button key={p.i} type="button" className={optie} onClick={() => kies(p)}>
            {p.w}
          </button>
        ))}
      </div>
      {resultaat !== null && (
        <p className={resultaat ? goedCls : foutCls}>
          {resultaat ? t.goed : `${t.juist} `}
          {!resultaat && <span lang={taal}>{o.zin}</span>} {speak(o.zin)}
        </p>
      )}
    </div>
  );
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
};
type RecognitionCtor = new () => Recognition;

/** The browser's speech recognition (Chrome, Edge, Safari; not Firefox), and only on https or localhost. */
function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  if (!window.isSecureContext) return null;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MAX_POGINGEN = 3;

function Zeg({ o, taal, audio, t, onDone }: Deel<"zeg">) {
  type Status = "klaar" | "luistert" | "nog-eens" | "goed" | "fout" | "zelf";
  // null until the browser has been asked: the server cannot know.
  const [kan, setKan] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("klaar");
  const [gehoord, setGehoord] = useState("");
  const [pogingen, setPogingen] = useState(0);
  const speak = zinSpeler(taal, audio, t);
  const vorm = useVorm();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser capability, unknown on the server
    setKan(recognitionCtor() !== null);
  }, []);

  const vraag = (
    <p>
      {fill(t.zegHardopIn, { taal: t.inTaal[taal] ?? taal })} <em>{vormen(o.vraag, vorm)}</em>
    </p>
  );
  const antwoord = (
    <>
      <span lang={taal}>{o.antwoorden[0]}</span> {speak(o.antwoorden[0]!)}
    </>
  );

  // No recognition (Firefox, http, or the microphone failed): listen, say it, judge yourself.
  if (kan === false || status === "zelf") {
    const beoordeeld = status === "goed" || status === "fout";
    return (
      <div className="space-y-4">
        {vraag}
        <p className="text-sm text-muted">
          {kan === false && t.geenHerkenning} {t.zelfBeoordelen}
        </p>
        <p>
          {t.voorbeeld}: {antwoord}
        </p>
        {!beoordeeld && (
          <div className="flex gap-2">
            <button type="button" className={primair} onClick={() => { setStatus("goed"); onDone(true, true); }}>
              {t.gelukt}
            </button>
            <button type="button" className={optie} onClick={() => { setStatus("fout"); onDone(false, true); }}>
              {t.nogNiet}
            </button>
          </div>
        )}
      </div>
    );
  }

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return setKan(false);
    const r = new Ctor();
    r.lang = localeOf(taal);
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      const alternatieven = Array.from(e.results[0] ?? []).map((x) => x.transcript);
      setGehoord(alternatieven[0] ?? "");
      const n = pogingen + 1;
      setPogingen(n);
      if (zegGoed(alternatieven, o.antwoorden)) {
        setStatus("goed");
        onDone(true);
      } else if (n >= MAX_POGINGEN) {
        setStatus("fout");
        onDone(false);
      } else setStatus("nog-eens");
    };
    r.onerror = () => setStatus("zelf");
    r.onend = () => setStatus((s) => (s === "luistert" ? "klaar" : s));
    setStatus("luistert");
    try {
      r.start();
    } catch {
      setStatus("zelf");
    }
  };

  const klaar = status === "goed" || status === "fout";
  return (
    <div className="space-y-4">
      {vraag}
      {o.voorbeeld && !klaar && (
        <p>
          {t.voorbeeld}: {speak(o.antwoorden[0]!)}
        </p>
      )}
      {!klaar && (
        <button type="button" className={primair} onClick={start} disabled={status === "luistert" || kan === null}>
          {status === "luistert" ? t.ikLuister : `🎤 ${t.spreek}`}
        </button>
      )}
      {!klaar && (
        // The way out when the microphone is refused or the recogniser never answers.
        <button type="button" className="ml-3 text-sm text-muted underline" onClick={() => setStatus("zelf")}>
          {t.zonderMicrofoon}
        </button>
      )}
      <div aria-live="polite" className="space-y-2">
        {gehoord && (
          <p className="text-muted">
            {t.gehoord} “<span lang={taal}>{gehoord}</span>”
          </p>
        )}
        {status === "nog-eens" && <p>{fill(t.bijna, { n: MAX_POGINGEN - pogingen })}</p>}
        {status === "goed" && <p className={goedCls}>{t.goed}</p>}
        {status === "fout" && (
          <p className={foutCls}>
            {t.bijvoorbeeld} {antwoord}
          </p>
        )}
      </div>
    </div>
  );
}

export function Oefeningen({ lesId, taal, oefeningen, audio, t }: Props) {
  const [stap, setStap] = useState(0);
  const [score, setScore] = useState(0);
  const [zelf, setZelf] = useState(0);
  const [beantwoord, setBeantwoord] = useState(false);

  if (!oefeningen.length) return null;

  if (stap >= oefeningen.length) {
    return (
      <div className="space-y-4 rounded-md border border-line bg-surface p-5">
        <p className="text-lg font-semibold">
          {fill(t.vanGoed, { score, totaal: oefeningen.length })}
          {zelf > 0 && <span className="font-normal text-muted"> ({fill(t.zelfBeoordeeld, { n: zelf })})</span>}
        </p>
        <button
          type="button"
          className={primair}
          onClick={() => {
            setStap(0);
            setScore(0);
            setZelf(0);
            setBeantwoord(false);
          }}
        >
          {t.nogEenKeer}
        </button>
      </div>
    );
  }

  const o = oefeningen[stap]!;
  const onDone: Done = (goed, zelfBeoordeeld) => {
    const nieuw = score + (goed ? 1 : 0);
    setScore(nieuw);
    if (zelfBeoordeeld) setZelf(zelf + 1);
    setBeantwoord(true);
    if (stap === oefeningen.length - 1) saveScore(lesId, nieuw, oefeningen.length);
  };
  const deel = { taal, audio, t, onDone };

  return (
    <div className="space-y-5 rounded-md border border-line bg-surface p-5">
      <p className="text-sm text-muted" aria-label={`${stap + 1} / ${oefeningen.length}`}>
        {stap + 1} / {oefeningen.length}
      </p>
      <div key={stap}>
        {(o.type === "kies" || o.type === "luister") && <Kies o={o} {...deel} />}
        {o.type === "typ" && <Typ o={o} {...deel} />}
        {o.type === "orden" && <Orden o={o} {...deel} />}
        {o.type === "zeg" && <Zeg o={o} {...deel} />}
      </div>
      {beantwoord && (
        <button
          type="button"
          className={primair}
          autoFocus
          onClick={() => {
            setStap(stap + 1);
            setBeantwoord(false);
          }}
        >
          {t.volgende}
        </button>
      )}
    </div>
  );
}
