"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * "Eén gegeven, vele jasjes": public service as one token through its phases,
 * in three layers (werkelijkheid, gegevens, data). The facts stick to the
 * token like pollen and stay the same chips throughout; only the jacket
 * around them (form, request, case file, letter, portal, order) changes. A
 * short contrast shows today's practice: a schema per phase, mapped again
 * each time. After the delivery the data stays (for questions, for the chain
 * partner CAK) and finally goes to the archive, a digital e-depot.
 *
 * Two looks for the reality layer: a drawing, or real photographs of the
 * places (home, town hall, supplier, CAK); a switch shows either. Plays by
 * itself; a pause button and the scene dots give control, and with reduced
 * motion it waits for a click (WCAG 2.2.2).
 *
 * One timeline (seconds) drives everything: each frame derives positions and
 * opacities from `t`, so a still of any scene is just a moment in time.
 */

const W = 1200;
const H = 640;
const LAYER = { real: [0, 210], given: [210, 290], data: [290, 560] } as const;

type Scene = { at: number; until: number; verb?: string; caption: string };
const SCENES: Scene[] = [
  { at: 0, until: 6, caption: "Werkelijkheid: iemand komt de trap niet meer op." },
  { at: 6, until: 12, verb: "informeer", caption: "Op de website staat de Wmo. Dat is informatie, maar nog niet over iemand." },
  { at: 12, until: 17, verb: "beslis", caption: "De inwoner besluit de Wmo aan te vragen. Nog steeds werkelijkheid: een keuze, nog geen gegeven." },
  { at: 17, until: 24, verb: "vul in", caption: "De werkelijkheid slaat neer als gegevens op het formulier." },
  { at: 24, until: 30, verb: "dien in", caption: "Ingediend zijn dezelfde gegevens een aanvraag." },
  { at: 30, until: 36, caption: "Zo gaat het nu: elke fase een eigen schema, en de gegevens worden telkens opnieuw gemapt." },
  { at: 36, until: 40, caption: "Met één canoniek model blijft het één geheel." },
  { at: 40, until: 48, verb: "behandel", caption: "Een medewerker opent de werkmap. Contactmomenten, zoals het keukentafelgesprek, komen erbij." },
  { at: 48, until: 55, verb: "beschik", caption: "De beschikking is dezelfde data in briefvorm. Een nieuwe zaak vraagt de traplift aan." },
  { at: 55, until: 61, verb: "volg", caption: "In het klantportaal: dezelfde gegevens, in een ander jasje." },
  { at: 61, until: 67, verb: "lever", caption: "Adres en nummers gaan mee naar de leverancier." },
  { at: 67, until: 75, caption: "De traplift staat er: de data is weer werkelijkheid geworden." },
  { at: 75, until: 82, verb: "deel", caption: "Het dossier blijft bewaard. Het CAK krijgt naam, adres en voorziening, en stuurt de eigen bijdrage terug." },
  { at: 82, until: 88, verb: "archiveer", caption: "Na de bewaartermijn gaat het dossier naar het archief: tegenwoordig een digitaal e-depot." },
  { at: 88, until: 94, caption: "De toestand van het systeem — gemeente en inwoners — is verbeterd." },
];
const LOOP = 97;

export type StoryLook = "tekening" | "foto";

/**
 * The decision (12–17 s) is a pause in the data story: the rest of the
 * timeline was drawn without it, so it reads `story(t)`, which holds at 12
 * during the decision and runs 5 s behind after it.
 */
const DECIDE = { at: 12, until: 17 } as const;
const story = (t: number) => (t < DECIDE.at ? t : t < DECIDE.until ? DECIDE.at : t - (DECIDE.until - DECIDE.at));

const CHIPS = [
  { label: "Naam", color: "#6366f1" },
  { label: "Adres", color: "#0891b2" },
  { label: "Traplift", color: "#d97706" },
  { label: "Tijdstippen", color: "#059669" },
  { label: "Partner", color: "#db2777" },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Progress 0..1 of t between a and b, eased. */
const seg = (t: number, a: number, b: number) => ease(clamp((t - a) / (b - a)));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Fade in at a, out at b (with a short ramp). */
const span = (t: number, a: number, b: number, ramp = 0.6) => Math.min(seg(t, a, a + ramp), 1 - seg(t, b - ramp, b));

type Jacket = "form" | "request" | "file" | "letter" | "portal" | "order" | "dossier";
// Where the token stands in each phase (data layer), and which jacket it wears.
const STATIONS: { at: number; x: number; jacket: Jacket }[] = [
  { at: 19, x: 260, jacket: "request" },
  { at: 35, x: 430, jacket: "file" },
  { at: 43, x: 600, jacket: "letter" },
  { at: 50, x: 770, jacket: "portal" },
  { at: 56, x: 940, jacket: "order" },
];

function tokenState(t: number): { x: number; y: number; show: number; scale?: number } {
  // Born on the form (gegevens), sinks into data, travels right, rises to werkelijkheid.
  if (t < 15) return { x: 260, y: 250, show: 0 };
  if (t < 19) return { x: 260, y: 250, show: seg(t, 15, 16) };
  if (t < 35) return { x: 260, y: lerp(250, 420, seg(t, 19, 21)), show: 1 };
  if (t < 62) {
    let x = 260;
    for (let i = 1; i < STATIONS.length; i++) {
      const s = STATIONS[i]!;
      x = lerp(x, s.x, seg(t, s.at, s.at + 1.6));
    }
    return { x, y: 420, show: 1 };
  }
  // The data stays when reality changes (a copy rises, see Ghost); then the dossier, the chain partner, the archive.
  if (t < 70) return { x: 940, y: 420, show: 1 };
  if (t < 77) return { x: lerp(940, 640, seg(t, 70, 71.5)), y: 420, show: 1 };
  const p = seg(t, 77, 79);
  return { x: lerp(640, 232, p), y: lerp(420, 472, p), show: 1 - seg(t, 80, 81), scale: lerp(1, 0.45, p) };
}

function jacketAt(t: number): Jacket | null {
  if (t >= 12 && t < 19) return "form";
  if (t >= 70 && t < 77) return "dossier";
  if (t >= 62) return null;
  let j: Jacket | null = null;
  for (const s of STATIONS) if (t >= s.at) j = s.jacket;
  return j;
}

export function ServiceStory({ look: initialLook = "tekening" }: { look?: StoryLook }) {
  const [t, setT] = useState(0);
  const [look, setLook] = useState<StoryLook>(initialLook);
  // Music (MusicBrain, 97 s = the timeline): off until the visitor turns it on; browsers do not autoplay sound.
  const [sound, setSound] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  // Fullscreen, for presenting: the figure itself fills the screen; space pauses, ← → step through the scenes.
  const figure = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === figure.current;
      setFull(on);
      if (on) figure.current?.focus(); // so space and the arrows work straight away
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void figure.current?.requestFullscreen?.();
  };
  const [playing, setPlaying] = useState(false);
  const start = useRef<number | null>(null);
  const base = useRef(0);

  // Autoplay, unless the visitor asked for less motion. `?story=<seconds>` holds one moment (stills), `?look=foto` picks the look.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the URL and the media query are only known in the browser */
    const q = new URLSearchParams(window.location.search);
    if (q.get("look") === "foto" || q.get("look") === "tekening") setLook(q.get("look") as StoryLook);
    const hold = q.get("story");
    if (hold !== null) {
      base.current = Number(hold) || 0;
      setT(base.current);
      return;
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    start.current = null;
    const tick = (now: number) => {
      if (start.current === null) start.current = now - base.current * 1000;
      const next = ((now - start.current) / 1000) % LOOP;
      base.current = next;
      setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // The music follows the timeline: same second, resynced when it drifts or the visitor jumps.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (sound && playing) {
      if (a.paused) {
        a.currentTime = t;
        a.play().catch(() => setSound(false));
      } else if (Math.abs(a.currentTime - t) > 0.35) a.currentTime = t;
    } else if (!a.paused) a.pause();
  }, [t, sound, playing]);

  const jump = (to: number) => {
    base.current = to;
    start.current = null;
    setT(to);
  };

  let scene = SCENES[0]!;
  for (const s of SCENES) if (t >= s.at) scene = s;
  const index = SCENES.indexOf(scene);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === " ") setPlaying((p) => !p);
    else if (e.key === "ArrowRight") jump(SCENES[(index + 1) % SCENES.length]!.at + 1);
    else if (e.key === "ArrowLeft") jump(SCENES[Math.max(0, index - 1)]!.at + 1);
    else return;
    e.preventDefault();
  };
  const st = story(t);
  const tok = tokenState(st);
  const jacket = jacketAt(st);
  const contrast = span(st, 25, 31);
  const reunite = span(st, 31, 35);
  const done = seg(st, 64, 67);

  return (
    <figure
      ref={figure}
      className={`service-story${full ? " is-full" : ""}`}
      aria-label="Animatie: één gegeven door het hele dienstverleningsproces"
      tabIndex={full ? 0 : undefined}
      onKeyDown={full ? onKey : undefined}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="ss-caption" className="w-full h-auto">
        <defs>
          <linearGradient id="ss-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="0.5" stopColor="#6366f1" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <pattern id="ss-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="#6366f1" strokeOpacity="0.07" />
          </pattern>
        </defs>

        <Layers t={st} />
        {look === "foto" ? <Places t={st} /> : <Reality t={st} done={done} />}
        <Decision t={t} look={look} />
        <WebInfo t={st} />
        <Drops t={st} look={look} />
        <Partner t={st} />
        <Archive t={st} />
        <Ghost t={st} look={look} />

        {/* The token with its jacket and its pollen. */}
        <g opacity={tok.show * (1 - 0.75 * contrast)} transform={`translate(${tok.x} ${tok.y}) scale(${tok.scale ?? 1})`}>
          {jacket && <JacketShape kind={jacket} t={st} />}
          <Pollen t={st} />
          <Returned t={st} />
          <circle r="16" fill="url(#ss-grad)" />
          <circle r="16" fill="none" stroke="#fff" strokeWidth="3" />
          {jacket === "file" && <Contacts t={st} />}
        </g>

        <Contrast p={contrast} />
        {reunite > 0 && (
          <text x={W / 2} y={350} textAnchor="middle" fontSize="26" fontWeight="700" fill="#4f46e5" opacity={reunite}>
            Eén canoniek model
          </text>
        )}

        {/* The phase as a verb, like a pill. */}
        {scene.verb && (
          <g transform={`translate(${W - 210} ${LAYER.given[0] + 20})`} opacity={span(t, scene.at, scene.until, 0.5)}>
            <rect width="180" height="40" rx="20" fill="#fff" stroke="#4f46e5" strokeWidth="2" />
            <text x="90" y="26" textAnchor="middle" fontSize="18" fontFamily="ui-monospace, monospace" fill="#4f46e5">
              {scene.verb} ▸
            </text>
          </g>
        )}

        <rect x="0" y={LAYER.data[1]} width={W} height={H - LAYER.data[1]} fill="#fff" />
        <text id="ss-caption" x={W / 2} y={H - 40} textAnchor="middle" fontSize="20" fill="#161826" opacity={span(t, scene.at, scene.until, 0.4)}>
          {scene.caption}
        </text>
      </svg>

      <div className="service-story-controls">
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pauzeer de animatie" : "Speel de animatie af"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" onClick={() => setSound((v) => !v)} aria-pressed={sound} aria-label={sound ? "Zet de muziek uit" : "Zet de muziek aan"}>
          {sound ? "🔊" : "🔈"}
        </button>
        <audio ref={audio} preload="none">
          <source src="/werkelijkheid/omnium-dienstverlening.ogg" type="audio/ogg" />
          <source src="/werkelijkheid/omnium-dienstverlening.mp3" type="audio/mpeg" />
        </audio>
        <button type="button" onClick={toggleFull} aria-pressed={full} aria-label={full ? "Volledig scherm verlaten" : "Volledig scherm (presentatie)"} title="Volledig scherm: spatie = pauze, ← → = scène">
          {full ? "✕" : "⛶"}
        </button>
        <div className="service-story-look" role="group" aria-label="Werkelijkheid als">
          {(["tekening", "foto"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={look === l} onClick={() => setLook(l)}>
              {l === "tekening" ? "Tekening" : "Foto's"}
            </button>
          ))}
        </div>
        <div className="service-story-dots" role="group" aria-label="Scènes">
          {SCENES.map((s, i) => (
            <button
              key={s.at}
              type="button"
              aria-label={`Scène ${i + 1}: ${s.verb ?? s.caption.split(":")[0]}`}
              aria-current={s === scene ? "step" : undefined}
              onClick={() => jump(s.at + 1)}
            />
          ))}
        </div>
      </div>
      <figcaption className="service-story-credits">
        Muziek: © 2026 MusicBrain.
        {look === "foto" && (
          <>
            {" "}
            Foto&apos;s via Wikimedia Commons: woonhuis Bingelrade, IJsbrand Heins / RCE (CC BY-SA 4.0); gemeentehuis Wierden,
          Okido (CC BY-SA 3.0); traplift op de rail, Mind meal (CC BY 2.0); traplift in huis, Bcm924 (CC BY-SA 4.0). CAK: foto CAK.
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Layers({ t }: { t: number }) {
  const lit = (a: number, b: number) => 0.55 + 0.45 * span(t, a, b, 0.8);
  return (
    <g>
      <rect x="0" y={LAYER.real[0]} width={W} height={LAYER.real[1]} fill="#fdf3e3" />
      <rect x="0" y={LAYER.given[0]} width={W} height={LAYER.given[1] - LAYER.given[0]} fill="#eef0ff" />
      <line x1="0" x2={W} y1={LAYER.given[0]} y2={LAYER.given[0]} stroke="#6366f1" strokeOpacity="0.25" strokeDasharray="6 6" />
      <line x1="0" x2={W} y1={LAYER.given[1]} y2={LAYER.given[1]} stroke="#6366f1" strokeOpacity="0.25" strokeDasharray="6 6" />
      <rect x="0" y={LAYER.data[0]} width={W} height={LAYER.data[1] - LAYER.data[0]} fill="url(#ss-grid)" />
      <rect x="0" y={LAYER.data[0]} width="6" height={LAYER.data[1] - LAYER.data[0]} fill="url(#ss-grad)" opacity={lit(19, 62)} />
      <g fontSize="15" fontWeight="700" letterSpacing="1.5" fill="#5b6075">
        <text x="20" y="30">WERKELIJKHEID</text>
        <text x="20" y={LAYER.given[0] + 24}>GEGEVENS</text>
        <text x="20" y={LAYER.data[0] + 30}>DATA</text>
      </g>
    </g>
  );
}

/** A house with stairs; the person below, and at the end upstairs on a stairlift. */
function Reality({ t, done }: { t: number; done: number }) {
  const px = lerp(520, 676, done);
  const py = lerp(176, 86, done);
  return (
    <g stroke="#7c4a1e" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M470 196 V96 L600 40 L730 96 V196 Z" fill="#fff8ee" />
      <path d="M560 196 h24 v-18 h24 v-18 h24 v-18 h24 v-18 h24 v-18" />
      {done > 0 && <path d="M560 186 L690 96" stroke="#d97706" strokeWidth="5" opacity={done} />}
      <g transform={`translate(${px} ${py})`}>
        <circle cy="-26" r="8" fill="#fff8ee" />
        <path d="M0 -18 V4 M-10 -8 H10 M0 4 L-8 18 M0 4 L8 18" />
      </g>
      {t < 12 && (
        <text x="500" y="150" fontSize="28" fill="#7c4a1e" stroke="none" opacity={span(t, 1, 12)}>
          ?
        </text>
      )}
      {done > 0 && (
        <text x="760" y="120" fontSize="18" fill="#7c4a1e" stroke="none" opacity={done}>
          ✓ geholpen
        </text>
      )}
      <g opacity={0.45 + 0.55 * span(t, 69.5, 83)}>
        <path d="M1030 196 V86 H1150 V196 M1030 112 H1150 M1030 138 H1150 M1030 164 H1150 M1070 86 V196 M1110 86 V196" />
        <text x="1090" y="74" textAnchor="middle" fontSize="16" fontWeight="700" fill="#7c4a1e" stroke="none">
          CAK
        </text>
      </g>
    </g>
  );
}

/** The decision: the resident chooses to apply. Still reality — a choice, not yet a fact on file. */
function Decision({ t, look }: { t: number; look: StoryLook }) {
  const o = span(t, DECIDE.at + 0.2, DECIDE.until);
  if (o <= 0) return null;
  const yes = seg(t, DECIDE.at + 2.2, DECIDE.at + 2.8);
  return (
    <g opacity={o}>
      {look === "tekening" && <path d="M528 128 q-6 -16 10 -22" fill="none" stroke="#7c4a1e" strokeWidth="2" strokeDasharray="3 4" />}
      <g transform={look === "foto" ? "translate(330 44)" : "translate(330 46)"}>
        <rect width="150" height="58" rx="29" fill="#fff" stroke="#7c4a1e" strokeWidth="2" />
        <text x="75" y={yes > 0.5 ? 26 : 35} textAnchor="middle" fontSize="15" fill="#7c4a1e">
          Wmo aanvragen?
        </text>
        <text x="75" y="45" textAnchor="middle" fontSize="14" fontWeight="700" fill="#059669" opacity={yes}>
          Ja, dat doe ik.
        </text>
      </g>
    </g>
  );
}

/**
 * The reality layer as real places, each above the data it belongs to: the
 * home, the town hall, the supplier, the chain partner. The place where the
 * story is, is lit; the others wait, greyed. At the end the home shows the
 * stairlift.
 */
const PLACES = [
  { id: "thuis", label: "Thuis", x: 140, src: "/werkelijkheid/thuis.jpg" },
  { id: "gemeente", label: "Gemeente", x: 490, src: "/werkelijkheid/gemeente.jpg" },
  { id: "leverancier", label: "Leverancier", x: 760, src: "/werkelijkheid/leverancier.jpg" },
  { id: "cak", label: "CAK · ketenpartner", x: 1000, src: "/werkelijkheid/cak.jpg" },
] as const;

function placeAt(t: number): string {
  if (t < 19 || (t >= 62 && t < 70) || t >= 83) return "thuis";
  if (t < 56) return "gemeente";
  if (t < 62) return "leverancier";
  return "cak";
}

function Places({ t }: { t: number }) {
  const here = placeAt(t);
  const after = seg(t, 63, 64.5);
  return (
    <g>
      <defs>
        <filter id="ss-grey">
          <feColorMatrix type="saturate" values="0.15" />
        </filter>
        {PLACES.map((p) => (
          <clipPath key={p.id} id={`ss-clip-${p.id}`}>
            <rect x={p.x} y="36" width="180" height="152" rx="10" />
          </clipPath>
        ))}
      </defs>
      {PLACES.map((p) => {
        const on = p.id === here;
        return (
          <g key={p.id} opacity={on ? 1 : 0.5} filter={on ? undefined : "url(#ss-grey)"}>
            <g clipPath={`url(#ss-clip-${p.id})`}>
              <image href={p.src} x={p.x} y="36" width="180" height="152" preserveAspectRatio="xMidYMid slice" />
              {p.id === "thuis" && (
                <image href="/werkelijkheid/traplift.jpg" x={p.x} y="36" width="180" height="152" preserveAspectRatio="xMidYMid slice" opacity={after} />
              )}
            </g>
            <rect x={p.x} y="36" width="180" height="152" rx="10" fill="none" stroke={on ? "#4f46e5" : "#c7b9a3"} strokeWidth={on ? 3 : 1} />
            <rect x={p.x + 8} y="160" width={p.label.length * 7.4 + 16} height="22" rx="11" fill="#fff" opacity="0.92" />
            <text x={p.x + 16} y="175" fontSize="12" fontWeight="700" fill="#161826">
              {p.label}
            </text>
          </g>
        );
      })}
      {after > 0 && (
        <text x="332" y="120" fontSize="17" fill="#7c4a1e" opacity={after}>
          ✓ geholpen
        </text>
      )}
    </g>
  );
}

/** When reality changes, the data does not leave: a copy of the facts rises and becomes reality. */
function Ghost({ t, look }: { t: number; look: StoryLook }) {
  if (t < 62 || t > 66) return null;
  const p = seg(t, 62, 65);
  const to = look === "foto" ? { x: 230, y: 110 } : { x: 640, y: 160 };
  return (
    <g transform={`translate(${lerp(940, to.x, p)} ${lerp(420, to.y, p)})`} opacity={(1 - seg(t, 64.5, 66)) * 0.8}>
      {CHIPS.map((c, i) => (
        <rect key={c.label} x="28" y={-48 + i * 22} width="104" height="18" rx="9" fill={c.color} opacity="0.7" />
      ))}
      <circle r="16" fill="url(#ss-grad)" opacity="0.6" />
    </g>
  );
}

/** The chain partner's own system: what it needs, no more. */
function Partner({ t }: { t: number }) {
  const o = span(t, 69.5, 83);
  if (o <= 0) return null;
  // What the municipality sends: the person, the address, the provision (on 72, 73 and 74: the music's three notes).
  const sent = [
    { label: "Naam", color: "#6366f1" },
    { label: "Adres", color: "#0891b2" },
    { label: "Traplift", color: "#d97706" },
  ];
  // What comes back: the contribution the CAK decides (from income data that come from elsewhere).
  const back = seg(t, 75, 76.6);
  const made = seg(t, 74.4, 75);
  return (
    <g opacity={o}>
      <rect x="1010" y="380" width="170" height="130" rx="10" fill="#fff" stroke="#4f46e5" strokeWidth="2" />
      <text x="1022" y="372" fontSize="13" fontWeight="700" fill="#161826">
        CAK · ketenpartner
      </text>
      {sent.map((c, i) => {
        const p = seg(t, 72 + i, 73.2 + i);
        const x = lerp(668, 1028, p);
        const y = lerp(372 + i * 22, 392 + i * 26, p);
        return (
          <g key={c.label} transform={`translate(${x} ${y})`} opacity={p > 0 ? 1 : 0}>
            <rect width="130" height="20" rx="10" fill={c.color} />
            <text x="65" y="14" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">
              {c.label}
            </text>
          </g>
        );
      })}
      {made > 0 && back < 1 && (
        <g transform={`translate(${lerp(1028, 668, back)} ${lerp(474, 484, back)})`} opacity={made}>
          <rect width="130" height="20" rx="10" fill="#64748b" />
          <text x="65" y="14" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">
            ← Eigen bijdrage
          </text>
        </g>
      )}
    </g>
  );
}

/** The contribution the CAK sent back: a sixth chip on the dossier, into the archive with it. */
function Returned({ t }: { t: number }) {
  if (t < 76.6) return null;
  return (
    <g transform="translate(28 62)">
      <rect width="104" height="18" rx="9" fill="#64748b" />
      <text x="52" y="13" textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff">
        Eigen bijdrage
      </text>
    </g>
  );
}

/** The archive: today a digital e-depot, in the data layer. */
function Archive({ t }: { t: number }) {
  const o = seg(t, 76, 77.5) * (1 - seg(t, 91, 92));
  if (o <= 0) return null;
  const glow = span(t, 80, 84, 0.8);
  return (
    <g opacity={o} transform="translate(40 430)">
      <rect width="270" height="86" rx="10" fill="#f5f6fa" stroke={glow > 0 ? "#4f46e5" : "#9aa0b4"} strokeWidth={1 + glow * 2} />
      <path d="M18 26 h22 v18 h-22 z M22 26 v-6 a7 7 0 0 1 14 0 v6" fill="none" stroke="#5b6075" strokeWidth="2" />
      <text x="52" y="32" fontSize="13" fontWeight="700" fill="#161826">
        e-Depot · archief
      </text>
      <text x="52" y="50" fontSize="11" fill="#5b6075">
        na de bewaartermijn
      </text>
      <text x="18" y="74" fontSize="11" fill="#5b6075" opacity={seg(t, 81, 82)}>
        dossier 0147 + 0148 gearchiveerd
      </text>
    </g>
  );
}

/** Scene 2: the regulation on the website — data, but about nobody yet. */
function WebInfo({ t }: { t: number }) {
  const o = span(t, 6.3, 19);
  if (o <= 0) return null;
  return (
    <g transform="translate(80 330)" opacity={o}>
      <rect width="190" height="120" rx="10" fill="#fff" stroke="#c7cbe0" />
      <rect width="190" height="22" rx="10" fill="#eef0ff" />
      <text x="12" y="16" fontSize="12" fill="#5b6075">gemeente.nl/wmo</text>
      <text x="12" y="50" fontSize="16" fontWeight="700" fill="#161826">Wmo</text>
      <text x="12" y="72" fontSize="12" fill="#5b6075">Hulp en voorzieningen</text>
      <text x="12" y="90" fontSize="12" fill="#5b6075">thuis: trapliften, …</text>
      <text x="12" y="110" fontSize="11" fill="#9aa0b4">(voor iedereen)</text>
    </g>
  );
}

/** Scene 3: reality comes down as facts. */
function Drops({ t, look }: { t: number; look: StoryLook }) {
  if (t < 12 || t > 17) return null;
  const from = look === "foto" ? { x: 230, y: 186 } : { x: 560, y: 196 };
  return (
    <g>
      {CHIPS.map((c, i) => {
        const p = seg(t, 12.2 + i * 0.35, 13.4 + i * 0.35);
        return <circle key={c.label} cx={lerp(from.x, 280 + i * 4, p)} cy={lerp(from.y, 250, p)} r="5" fill={c.color} opacity={p > 0 && p < 1 ? 1 : 0} />;
      })}
    </g>
  );
}

/** The facts: the same five chips the whole way, beside the token. */
function Pollen({ t }: { t: number }) {
  return (
    <g>
      {CHIPS.map((c, i) => {
        const born = seg(t, 13.4 + i * 0.35, 14 + i * 0.35);
        const flash = t > 19.5 && t < 21 ? 0.6 + 0.4 * Math.abs(Math.sin((t - 19.5) * 6)) : 1;
        const dissolve = 1;
        return (
          <g key={c.label} transform={`translate(28 ${-48 + i * 22})`} opacity={born * flash * dissolve}>
            <rect width="104" height="18" rx="9" fill={c.color} />
            <text x="52" y="13" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">
              {c.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** The jacket: the view the same facts are shown in. */
function JacketShape({ kind, t }: { kind: Jacket; t: number }) {
  const x = -34;
  const y = -78;
  const w = 182;
  const h = kind === "dossier" ? 166 : 150;
  const title: Record<Jacket, string> = {
    form: "Aanvraagformulier",
    request: "Aanvraag · ingediend",
    file: "Werkmap · zaak 0147",
    letter: "Beschikking",
    portal: "Mijn gemeente",
    order: "Order · leverancier",
    dossier: "Dossier · bewaard",
  };
  const stroke = "#4f46e5";
  return (
    <g>
      {kind === "file" && <path d={`M${x} ${y} h60 l10 -12 h40 l10 12 h${w - 120} v${h} h${-w} Z`} fill="#fff7e6" stroke="#d97706" strokeWidth="2" />}
      {kind === "letter" && <path d={`M${x} ${y} h${w - 22} l22 22 v${h - 22} h${-w} Z`} fill="#fff" stroke={stroke} strokeWidth="2" />}
      {kind === "portal" && (
        <g>
          <rect x={x} y={y - 14} width={w} height={h + 14} rx="10" fill="#fff" stroke={stroke} strokeWidth="2" />
          <circle cx={x + 12} cy={y - 4} r="3" fill="#c7cbe0" />
          <circle cx={x + 22} cy={y - 4} r="3" fill="#c7cbe0" />
          <circle cx={x + 32} cy={y - 4} r="3" fill="#c7cbe0" />
        </g>
      )}
      {(kind === "form" || kind === "request" || kind === "order" || kind === "dossier") && (
        <rect x={x} y={y} width={w} height={h} rx="8" fill="#fff" stroke={kind === "form" ? "#9aa0b4" : stroke} strokeWidth="2" strokeDasharray={kind === "form" ? "6 5" : undefined} />
      )}
      <text x={x + 10} y={y - (kind === "portal" ? 20 : 8)} fontSize="13" fontWeight="700" fill="#161826">
        {title[kind]}
      </text>
      {kind === "letter" && t > 46 && (
        <text x={x} y={y + h + 22} fontSize="12" fill="#5b6075" opacity={seg(t, 46, 47)}>
          zaak 0147 gesloten · nieuwe zaak 0148 geopend
        </text>
      )}
      {kind === "order" && (
        <text x={x} y={y + h + 22} fontSize="12" fill="#5b6075">
          → leverancier (buiten de gemeente)
        </text>
      )}
    </g>
  );
}

/** Contact moments, added to the case file. */
function Contacts({ t }: { t: number }) {
  const items = ["Gebeld 14/10", "Keukentafelgesprek", "Extra gegevens"];
  return (
    <g>
      {items.map((label, i) => {
        const o = seg(t, 37 + i * 1.6, 37.6 + i * 1.6);
        return (
          <g key={label} transform={`translate(${160 + 8} ${-60 + i * 26})`} opacity={o}>
            <rect width="132" height="20" rx="10" fill="#f1f2f6" stroke="#c7cbe0" />
            <text x="66" y="14" textAnchor="middle" fontSize="11" fill="#5b6075">
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Today's practice: three schemas, mapped and renamed; a fact falls off on the way. */
function Contrast({ p }: { p: number }) {
  if (p <= 0) return null;
  const boxes = [
    { title: "formulier.json", names: ["naam", "adres", "voorziening", "tijdstippen", "partner"] },
    { title: "aanvraag.json", names: ["fullName", "address", "requestedItem", "slots", "partner"] },
    { title: "procesdata.json", names: ["nm", "adr", "prod_code", "—", "—"] },
  ];
  return (
    <g opacity={p}>
      <rect x="140" y={LAYER.data[0] + 16} width={W - 280} height={LAYER.data[1] - LAYER.data[0] - 32} rx="14" fill="#fff" stroke="#e11d48" strokeOpacity="0.35" />
      {boxes.map((b, i) => (
        <g key={b.title} transform={`translate(${200 + i * 300} ${LAYER.data[0] + 50})`}>
          <rect width="200" height="170" rx="8" fill="#fff" stroke="#9aa0b4" />
          <text x="12" y="22" fontSize="13" fontWeight="700" fontFamily="ui-monospace, monospace" fill="#161826">
            {b.title}
          </text>
          {b.names.map((n, j) => (
            <text key={j} x="16" y={48 + j * 24} fontSize="13" fontFamily="ui-monospace, monospace" fill={n === "—" ? "#e11d48" : "#5b6075"}>
              {n === "—" ? "✗ kwijt" : `"${n}"`}
            </text>
          ))}
          {i < 2 && (
            <g transform="translate(206 80)">
              <path d="M0 0 H84 M74 -8 L84 0 L74 8" stroke="#e11d48" strokeWidth="2" fill="none" />
              <text x="42" y="-10" textAnchor="middle" fontSize="11" fill="#e11d48">
                mapping
              </text>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}
