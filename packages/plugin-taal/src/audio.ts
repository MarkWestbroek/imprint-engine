import { createHash } from "node:crypto";
import type { Les } from "./schemas";

/**
 * Which sentences of a lesson get a recording, and under which key (Node
 * only: the server viewers and the admin action). A key is a hash of voice,
 * tempo and text, as in the prototype (tts-build.mjs): the same sentence in
 * another lesson has the same key, and a changed sentence or another voice
 * has a new one. That is what keeps text-to-speech from being paid twice.
 */

/** One voice per language. Another voice = other keys = new recordings. */
export const STEMMEN: Record<string, { locale: string; voice: string }> = {
  nl: { locale: "nl-NL", voice: "nl-NL-FennaNeural" },
  pl: { locale: "pl-PL", voice: "pl-PL-ZofiaNeural" },
  it: { locale: "it-IT", voice: "it-IT-ElsaNeural" },
  de: { locale: "de-DE", voice: "de-DE-KatjaNeural" },
};
export type Stemmen = typeof STEMMEN;

/** Two tempos: normal, and slow for "langzaam, alstublieft" (SSML prosody rate). */
export const TEMPI = { normal: "0%", slow: "-30%" } as const;
export type Tempo = keyof typeof TEMPI;

export type Zin = { text: string; lang: string };

/** What the browser gets: per sentence the URLs that exist. Keyed with `zinKey`. */
export type AudioKaart = Record<string, Partial<Record<Tempo, string>>>;

export const zinKey = (lang: string, text: string): string => `${lang}|${text}`;

export function audioSleutel(voice: string, tempo: Tempo, text: string): string {
  return createHash("sha1").update(`${voice}|${TEMPI[tempo]}|${text}`).digest("hex").slice(0, 16);
}

/**
 * The sentences a learner can play, each once: the dialogue, the chunks, and
 * what the exercises read out. Only the language being taught — the
 * translations are read, not listened to.
 */
export function zinnen(les: Pick<Les, "taal" | "dialoog" | "brokken" | "oefeningen">): Zin[] {
  const lang = les.taal;
  const texts: string[] = [];
  for (const regel of les.dialoog) if (regel[lang]) texts.push(regel[lang]);
  texts.push(...les.brokken);
  for (const o of les.oefeningen) {
    if (o.type === "luister") texts.push(o.tekst);
    if (o.type === "orden") texts.push(o.zin);
    if (o.type === "zeg" || o.type === "typ") texts.push(o.antwoorden[0]!);
  }
  const seen = new Set<string>();
  return texts
    .map((t) => t.trim())
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .map((text) => ({ text, lang }));
}

export type Opname = Zin & { tempo: Tempo; sleutel: string; voice: string };

/** Every recording a lesson needs (sentence × tempo); sentences in a language without a voice are left out. */
export function opnamen(les: Pick<Les, "taal" | "dialoog" | "brokken" | "oefeningen">, stemmen: Stemmen = STEMMEN): Opname[] {
  return zinnen(les).flatMap((zin) => {
    const stem = stemmen[zin.lang];
    if (!stem) return [];
    return (Object.keys(TEMPI) as Tempo[]).map((tempo) => ({ ...zin, tempo, voice: stem.voice, sleutel: audioSleutel(stem.voice, tempo, zin.text) }));
  });
}

/** The recordings a lesson needs and does not have; `bekend` are those of the other lessons. */
export function ontbrekend(les: Les, bekend: Record<string, string> = {}, stemmen: Stemmen = STEMMEN): Opname[] {
  return opnamen(les, stemmen).filter((o) => !les.audio[o.sleutel] && !bekend[o.sleutel]);
}

/** The recordings of a lesson that exist, for the play buttons. */
export function audioKaart(les: Les, stemmen: Stemmen = STEMMEN): AudioKaart {
  const kaart: AudioKaart = {};
  for (const o of opnamen(les, stemmen)) {
    const url = les.audio[o.sleutel];
    if (url) (kaart[zinKey(o.lang, o.text)] ??= {})[o.tempo] = url;
  }
  return kaart;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function ssml(text: string, stem: { locale: string; voice: string }, tempo: Tempo): string {
  return (
    `<speak version="1.0" xml:lang="${stem.locale}">` +
    `<voice name="${stem.voice}"><prosody rate="${TEMPI[tempo]}">${escapeXml(text)}</prosody></voice>` +
    `</speak>`
  );
}
