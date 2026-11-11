// Afspeelknopje voor één zin. Zoekt de MP3 op in /audio/manifest.json.
// Valt terug op de browserstem (Web Speech API) als er geen opname is.
//
// <Speak text="Wat is dit?" lang="nl" />

import { useEffect, useState } from "react";

let manifestPromise;
const loadManifest = () =>
  (manifestPromise ??= fetch("/audio/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

const LOCALES = { nl: "nl-NL", pl: "pl-PL", it: "it-IT", de: "de-DE" };

export default function Speak({ text, lang }) {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    loadManifest().then((m) => setEntry(m?.[lang]?.[text] ?? null));
  }, [text, lang]);

  const play = (speed) => {
    if (entry?.[speed]) {
      new Audio(`/audio/${entry[speed]}`).play();
    } else if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LOCALES[lang] ?? lang;
      u.rate = speed === "slow" ? 0.7 : 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  };

  return (
    <span className="speak">
      <button type="button" onClick={() => play("normal")} aria-label={`Speel af: ${text}`}>▶</button>
      <button type="button" onClick={() => play("slow")} aria-label={`Langzaam: ${text}`}>🐢</button>
    </span>
  );
}
