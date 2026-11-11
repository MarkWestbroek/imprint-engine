// Interactieve oefeningen voor één les, gevoed uit de frontmatter (`oefeningen`).
// Typen: kies (meerkeuze), luister (hoor en kies), typ (vertaal en typ), orden (woorden op volgorde),
//        zeg (hardop zeggen, via spraakherkenning van de browser; max. 3 pogingen).
// Voortgang per les wordt in localStorage bewaard.
//
// <Oefeningen les={frontmatter} />

import { useMemo, useState } from "react";
import Speak from "./Speak.jsx";

// Soepel vergelijken: hoofdletters, leestekens en dubbele spaties tellen niet mee.
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
   .replace(/[.,!?¿¡‘’'"“”„…]/g, "").replace(/\s+/g, " ").trim();

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function saveScore(id, score, total) {
  try {
    const all = JSON.parse(localStorage.getItem("taal-voortgang") ?? "{}");
    all[id] = { score, total, datum: new Date().toISOString().slice(0, 10) };
    localStorage.setItem("taal-voortgang", JSON.stringify(all));
  } catch { /* opslag niet beschikbaar: geen probleem */ }
}

function Kies({ o, lang, onDone }) {
  const [gekozen, setGekozen] = useState(null);
  const klaar = gekozen !== null;
  return (
    <div>
      {o.type === "luister"
        ? <p>Luister: <Speak text={o.tekst} lang={lang} /></p>
        : <p>{o.vraag}</p>}
      <div className="opties">
        {o.opties.map((opt, i) => (
          <button
            key={i}
            disabled={klaar}
            className={klaar ? (i === o.antwoord ? "goed" : i === gekozen ? "fout" : "") : ""}
            onClick={() => { setGekozen(i); onDone(i === o.antwoord); }}
          >{opt}</button>
        ))}
      </div>
    </div>
  );
}

function Typ({ o, onDone }) {
  const [invoer, setInvoer] = useState("");
  const [resultaat, setResultaat] = useState(null);
  const check = (e) => {
    e.preventDefault();
    const goed = o.antwoorden.some((a) => norm(a) === norm(invoer));
    setResultaat(goed);
    onDone(goed);
  };
  return (
    <form onSubmit={check}>
      <p>Zeg in het Nederlands: <em>{o.vraag}</em></p>
      <input value={invoer} onChange={(e) => setInvoer(e.target.value)} disabled={resultaat !== null} autoFocus />
      {resultaat === null && <button type="submit">Controleer</button>}
      {resultaat === true && <p className="goed">Goed!</p>}
      {resultaat === false && <p className="fout">Bijvoorbeeld: {o.antwoorden[0]}</p>}
    </form>
  );
}

function Orden({ o, lang, onDone }) {
  const woorden = useMemo(() => o.zin.split(" "), [o.zin]);
  const [pool, setPool] = useState(() => shuffle(woorden.map((w, i) => ({ w, i }))));
  const [zin, setZin] = useState([]);
  const [resultaat, setResultaat] = useState(null);

  const kies = (item) => {
    const nieuw = [...zin, item];
    setZin(nieuw);
    setPool(pool.filter((p) => p !== item));
    if (nieuw.length === woorden.length) {
      const goed = nieuw.map((p) => p.w).join(" ") === o.zin;
      setResultaat(goed);
      onDone(goed);
    }
  };
  const terug = (item) => {
    if (resultaat !== null) return;
    setZin(zin.filter((p) => p !== item));
    setPool([...pool, item]);
  };

  return (
    <div>
      <p>Zet de woorden op volgorde.</p>
      <div className="zin">{zin.map((p) => <button key={p.i} onClick={() => terug(p)}>{p.w}</button>)}</div>
      <div className="pool">{pool.map((p) => <button key={p.i} onClick={() => kies(p)}>{p.w}</button>)}</div>
      {resultaat !== null && (
        <p className={resultaat ? "goed" : "fout"}>
          {resultaat ? "Goed!" : `Juist: ${o.zin}`} <Speak text={o.zin} lang={lang} />
        </p>
      )}
    </div>
  );
}

// Spraakherkenning van de browser (Chrome, Edge, Safari; niet Firefox). Werkt alleen via https.
const Herkenning = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

const LOCALES = { nl: "nl-NL", pl: "pl-PL", it: "it-IT", de: "de-DE" };

// Levenshtein-afstand, om kleine herkenningsfoutjes ("pinne" i.p.v. "pinnen") toe te laten.
function afstand(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const lijktOp = (gehoord, goed) => {
  const a = norm(gehoord), b = norm(goed);
  return a === b || 1 - afstand(a, b) / Math.max(b.length, 1) >= 0.85;
};

function Zeg({ o, lang, onDone }) {
  const [status, setStatus] = useState("klaar"); // klaar | luistert | goed | fout | fout-tech
  const [gehoord, setGehoord] = useState("");
  const [pogingen, setPogingen] = useState(0);

  if (!Herkenning) {
    return (
      <div>
        <p>Spreken werkt niet in deze browser. Probeer Chrome of Safari.</p>
        <button onClick={() => onDone(false)}>Overslaan</button>
      </div>
    );
  }

  const start = () => {
    const r = new Herkenning();
    r.lang = LOCALES[lang] ?? lang;
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      const alternatieven = Array.from(e.results[0]).map((x) => x.transcript);
      setGehoord(alternatieven[0]);
      const goed = alternatieven.some((alt) => o.antwoorden.some((a) => lijktOp(alt, a)));
      const n = pogingen + 1;
      setPogingen(n);
      if (goed) { setStatus("goed"); onDone(true); }
      else if (n >= 3) { setStatus("fout"); onDone(false); }
      else setStatus("nog-eens");
    };
    r.onerror = () => setStatus("fout-tech");
    r.onend = () => setStatus((s) => (s === "luistert" ? "klaar" : s));
    setStatus("luistert");
    r.start();
  };

  const klaar = status === "goed" || status === "fout";
  return (
    <div>
      <p>Zeg hardop in het Nederlands: <em>{o.vraag}</em></p>
      {o.voorbeeld && <p>Voorbeeld: <Speak text={o.antwoorden[0]} lang={lang} /></p>}
      {!klaar && (
        <button onClick={start} disabled={status === "luistert"}>
          {status === "luistert" ? "Ik luister…" : "🎤 Spreek"}
        </button>
      )}
      {gehoord && <p>Gehoord: “{gehoord}”</p>}
      {status === "nog-eens" && <p>Bijna. Probeer nog eens ({3 - pogingen} over).</p>}
      {status === "fout-tech" && (
        <p>De microfoon werkte niet. <button onClick={() => onDone(false)}>Overslaan</button></p>
      )}
      {status === "goed" && <p className="goed">Goed!</p>}
      {status === "fout" && <p className="fout">Bijvoorbeeld: {o.antwoorden[0]} <Speak text={o.antwoorden[0]} lang={lang} /></p>}
    </div>
  );
}

export default function Oefeningen({ les }) {
  const lijst = les.oefeningen ?? [];
  const [stap, setStap] = useState(0);
  const [score, setScore] = useState(0);
  const [beantwoord, setBeantwoord] = useState(false);

  if (!lijst.length) return null;

  if (stap >= lijst.length) {
    return (
      <div className="oefeningen klaar">
        <p>{score} van {lijst.length} goed.</p>
        <button onClick={() => { setStap(0); setScore(0); setBeantwoord(false); }}>Nog een keer</button>
      </div>
    );
  }

  const o = lijst[stap];
  const onDone = (goed) => {
    const nieuweScore = score + (goed ? 1 : 0);
    setScore(nieuweScore);
    setBeantwoord(true);
    if (stap === lijst.length - 1) saveScore(les.id, nieuweScore, lijst.length);
  };
  const volgende = () => { setStap(stap + 1); setBeantwoord(false); };

  const props = { o, lang: les.taal, onDone };
  return (
    <div className="oefeningen">
      <p className="teller">{stap + 1} / {lijst.length}</p>
      <div key={stap}>
        {(o.type === "kies" || o.type === "luister") && <Kies {...props} />}
        {o.type === "typ" && <Typ {...props} />}
        {o.type === "orden" && <Orden {...props} />}
        {o.type === "zeg" && <Zeg {...props} />}
      </div>
      {beantwoord && <button onClick={volgende}>Volgende</button>}
    </div>
  );
}
