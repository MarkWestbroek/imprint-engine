import { revalidatePath } from "next/cache";
import type { AdminContext } from "@imprint/runtime-admin";
import { ontbrekend, opnamen, zinnen, STEMMEN, type Stemmen } from "./audio";
import { getLes, listLessen } from "./lessen";
import type { Les } from "./schemas";
import type { Synthesize } from "./tts";

/**
 * The recordings of the lessons, run through the site's plugin dispatcher.
 * Text-to-speech is paid per character, so `genereerAudio` only asks for
 * what no lesson has yet: the key of a recording is a hash of voice, tempo
 * and text (audio.ts), and a sentence another lesson already has is reused.
 * The bytes go to the AssetStore, the URLs into the lesson (a new version).
 */

export type AudioStatus = {
  id: string;
  titel: string;
  taal: string;
  /** Sentences that can be played. */
  zinnen: number;
  /** Recordings to make (sentence × tempo), and their characters: what a run costs. */
  ontbreekt: number;
  tekens: number;
  /** Missing here, present in another lesson: free to take over. */
  hergebruik: number;
};

export type AudioOverzicht = { kan: boolean; lessen: AudioStatus[] };

export type AudioResult = { ok: boolean; error?: string; gemaakt?: number; hergebruikt?: number };

export type TaalActionOptions = { synthesize: Synthesize | null; stemmen?: Stemmen; /** Pause between requests, in ms. */ pauze?: number };

/** The recordings of every lesson but this one. */
function vanAnderen(lessen: Les[], id: string): Record<string, string> {
  return Object.assign({}, ...lessen.filter((l) => l.id !== id).map((l) => l.audio)) as Record<string, string>;
}

export function statusVan(les: Les, lessen: Les[], stemmen: Stemmen = STEMMEN): AudioStatus {
  const bekend = vanAnderen(lessen, les.id);
  const nieuw = ontbrekend(les, bekend, stemmen);
  return {
    id: les.id,
    titel: les.titel,
    taal: les.taal,
    zinnen: zinnen(les).length,
    ontbreekt: nieuw.length,
    tekens: nieuw.reduce((n, o) => n + o.text.length, 0),
    hergebruik: opnamen(les, stemmen).filter((o) => !les.audio[o.sleutel] && bekend[o.sleutel]).length,
  };
}

export function taalActions(opts: TaalActionOptions) {
  const stemmen = opts.stemmen ?? STEMMEN;

  async function audioStatus(admin: AdminContext): Promise<AudioOverzicht | null> {
    const store = admin.imprint.writableStore;
    if (!store || !(await admin.auth.editingSession())) return null;
    const lessen = await listLessen(store);
    return { kan: opts.synthesize !== null, lessen: lessen.map((les) => statusVan(les, lessen, stemmen)) };
  }

  async function genereerAudio(admin: AdminContext, id: string): Promise<AudioResult> {
    const session = await admin.auth.editingSession();
    if (!session) return { ok: false, error: "Niet ingelogd." };
    const store = admin.imprint.writableStore;
    if (!store) return { ok: false, error: "Hiervoor is de database nodig (DATABASE_URL)." };
    const les = await getLes(store, String(id));
    if (!les) return { ok: false, error: "Deze les bestaat niet." };

    const bekend = vanAnderen(await listLessen(store), les.id);
    const audio = { ...les.audio };
    let gemaakt = 0;
    let hergebruikt = 0;
    let error: string | undefined;
    for (const o of opnamen(les, stemmen)) {
      if (audio[o.sleutel]) continue;
      if (bekend[o.sleutel]) {
        audio[o.sleutel] = bekend[o.sleutel]!;
        hergebruikt++;
        continue;
      }
      if (!opts.synthesize) {
        // Keep going: what another lesson has can still be taken over.
        error = "Er is geen sleutel voor tekst-naar-spraak (AZURE_TTS_KEY).";
        continue;
      }
      try {
        const bytes = await opts.synthesize(o.text, stemmen[o.lang]!, o.tempo);
        audio[o.sleutel] = await admin.imprint.assets.put(`taal/tts/${o.sleutel}.mp3`, bytes);
        gemaakt++;
      } catch (err) {
        // Stop at the first failure, and keep what was made: it is paid for.
        error = err instanceof Error ? err.message : String(err);
        break;
      }
      if (opts.pauze !== 0) await new Promise((r) => setTimeout(r, opts.pauze ?? 150));
    }

    if (gemaakt + hergebruikt > 0) {
      await store.putItem("les", les.id, { ...les, audio }, { by: session.name });
      try {
        revalidatePath("/", "layout");
      } catch {
        // no Next.js request context (a test)
      }
    }
    return error ? { ok: false, error, gemaakt, hergebruikt } : { ok: true, gemaakt, hergebruikt };
  }

  return { audioStatus, genereerAudio };
}
