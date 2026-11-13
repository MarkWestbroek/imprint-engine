import { revalidatePath } from "next/cache";
import type { AdminContext } from "@imprint/runtime-admin";
import { ontbrekend, opnamen, zinnen, STEMMEN, type Stemmen } from "./audio";
import { getLes, listLessen } from "./lessen";
import type { Les } from "./schemas";
import { beste, isScore, isVorm, lesSleutel, SCOPE, type Stand, type Voortgang } from "./stand";
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

export type LidResult = { ok: boolean; error?: string };

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

  /**
   * The learner's side: results and the choice of forms of whoever is signed
   * in (any member, no role needed). Without a session the answer is "not
   * signed in" and the browser keeps its own copy.
   */
  async function lid(admin: AdminContext) {
    const users = admin.imprint.users;
    const session = users ? await admin.auth.getSession() : null;
    return users && session ? { users, naam: session.name } : null;
  }

  async function stand(admin: AdminContext): Promise<Stand> {
    const wie = await lid(admin);
    if (!wie) return { ingelogd: false };
    const waarden = await wie.users.memberValues(wie.naam, SCOPE);
    const voortgang: Voortgang = {};
    for (const [sleutel, waarde] of Object.entries(waarden)) {
      if (sleutel.startsWith("les:") && isScore(waarde)) voortgang[sleutel.slice(4)] = waarde;
    }
    return { ingelogd: true, naam: wie.naam, voortgang, vorm: isVorm(waarden.vorm) ? waarden.vorm : null };
  }

  /** Keep results (`{ "nl-0-01": { score, total, datum } }`): only of lessons that exist, and only when better than what is kept. */
  async function bewaar(admin: AdminContext, scores: unknown): Promise<LidResult> {
    const wie = await lid(admin);
    const store = admin.imprint.writableStore;
    if (!wie || !store) return { ok: false, error: "Niet ingelogd." };
    if (!scores || typeof scores !== "object") return { ok: false, error: "Geen resultaten." };
    const bestaat = new Set((await listLessen(store)).map((l) => l.id));
    const bewaard = await wie.users.memberValues(wie.naam, SCOPE);
    for (const [id, score] of Object.entries(scores)) {
      if (!bestaat.has(id) || !isScore(score)) continue;
      const oud = bewaard[lesSleutel(id)];
      const nieuw = { score: score.score, total: score.total, datum: score.datum };
      if (beste(isScore(oud) ? oud : undefined, nieuw) === nieuw) await wie.users.setMemberValue(wie.naam, SCOPE, lesSleutel(id), nieuw);
    }
    return { ok: true };
  }

  async function zetVorm(admin: AdminContext, vorm: unknown): Promise<LidResult> {
    const wie = await lid(admin);
    if (!wie) return { ok: false, error: "Niet ingelogd." };
    await wie.users.setMemberValue(wie.naam, SCOPE, "vorm", isVorm(vorm) ? vorm : null);
    return { ok: true };
  }

  return { audioStatus, genereerAudio, stand, bewaar, zetVorm };
}
