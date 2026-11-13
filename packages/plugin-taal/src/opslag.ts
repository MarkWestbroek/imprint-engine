import { useSyncExternalStore } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import { beste, isVorm, leesVoortgang, samenvoegen, type Stand } from "./stand";
import type { Vorm } from "./tekst";

/**
 * What the learner keeps, for the client parts: results and the choice of
 * forms in this browser (localStorage), and for a member also on the server.
 * The browser is always the first to know and works without an account; the
 * server is asked once per page load (`koppel`), and then both are made equal.
 */
export const VOORTGANG_KEY = "taal-voortgang";
export const VORM_KEY = "taal-vorm";

const luisteraars = new Set<() => void>();

function lees(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function schrijf(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // no storage (private mode): it is just not kept
  }
  luisteraars.forEach((cb) => cb());
}

function volg(cb: () => void) {
  luisteraars.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    luisteraars.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** A kept value as text; null on the server and in the first render. */
export const useOpslag = (key: string): string | null => useSyncExternalStore(volg, () => lees(key), () => null);

let call: PluginCall | undefined;
let ingelogd = false;
let gevraagd = false;

/** Ask the server who is looking, once; for a member, bring browser and account in line. */
export async function koppel(c?: PluginCall): Promise<void> {
  if (!c || gevraagd) return;
  gevraagd = true;
  call = c;
  try {
    const stand = (await c("taal", "stand")) as Stand | null;
    if (!stand?.ingelogd) return;
    ingelogd = true;
    const { samen, naarServer } = samenvoegen(leesVoortgang(lees(VOORTGANG_KEY)), stand.voortgang);
    schrijf(VOORTGANG_KEY, JSON.stringify(samen));
    if (Object.keys(naarServer).length > 0) await c("taal", "bewaar", naarServer);
    const lokaal = lees(VORM_KEY);
    if (stand.vorm) schrijf(VORM_KEY, stand.vorm);
    else if (isVorm(lokaal)) await c("taal", "zetVorm", lokaal);
  } catch {
    // offline or no server: the browser's own copy stands
  }
}

/** Before signing in or out: the next page asks the server again who is looking. */
export function vergeetKoppeling() {
  gevraagd = false;
  ingelogd = false;
}

/** Signing out, or the account is gone: what this browser kept goes too, so the next learner here starts clean. */
export function vergeetLokaal() {
  vergeetKoppeling();
  schrijf(VOORTGANG_KEY, null);
  schrijf(VORM_KEY, null);
}

const naarServer = (action: string, ...args: unknown[]) => {
  if (ingelogd && call) call("taal", action, ...args).catch(() => {});
};

/** A finished lesson: the best result is kept. */
export function bewaarScore(id: string, score: number, total: number) {
  const nieuw = { score, total, datum: new Date().toISOString().slice(0, 10) };
  const alle = leesVoortgang(lees(VOORTGANG_KEY));
  alle[id] = beste(alle[id], nieuw)!;
  schrijf(VOORTGANG_KEY, JSON.stringify(alle));
  naarServer("bewaar", { [id]: nieuw });
}

export function bewaarVorm(vorm: Vorm | null) {
  schrijf(VORM_KEY, vorm);
  naarServer("zetVorm", vorm);
}
