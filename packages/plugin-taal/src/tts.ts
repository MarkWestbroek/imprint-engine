import { ssml, type Tempo } from "./audio";

/** Turns one sentence into audio (mp3 bytes). The admin action gets one handed in, so a test needs no Azure. */
export type Synthesize = (text: string, stem: { locale: string; voice: string }, tempo: Tempo) => Promise<Uint8Array>;

export type TtsConfig = { key?: string; region?: string };

/**
 * Azure text-to-speech over REST (as prototype/tts-build.mjs): one request
 * per sentence and tempo, SSML with `prosody rate`, mp3 back. Null without a
 * key: the site then keeps playing the browser's own voice.
 */
export function azureTts(cfg: TtsConfig = {}, fetcher: typeof fetch = fetch): Synthesize | null {
  const key = cfg.key;
  if (!key) return null;
  const region = cfg.region || "westeurope";
  return async (text, stem, tempo) => {
    const res = await fetcher(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "imprint-tts",
      },
      body: ssml(text, stem, tempo),
    });
    if (!res.ok) throw new Error(`Azure TTS ${res.status} for "${text}": ${(await res.text()).slice(0, 200)}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
