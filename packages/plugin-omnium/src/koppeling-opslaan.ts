import { OmniumRegister, registerConfigFromEnv } from "./client";
import { Inrichting } from "./inrichting";
import { binnenWhitelist, isDoorgevoerd, planKoppeling, vastgelegdeKoppelingen, type KoppelingHandeling, type Registratie } from "./koppeling-register";

/**
 * Saving one action on the lines (draw, move, erase) as one registration in
 * the register (Fundament §9). Server only: the token of the writing account
 * (rol bouwer, `OMNIUM_KOPPELING_TOKEN`) never leaves the server, and only a
 * registration about Koppeling and its relation on the e-dienstversie passes
 * (whitelist). Read just before, never resend after a time-out: read again.
 */

export type KoppelingResultaat = { ok: true; melding: string } | { ok: false; fout: string };

const TIMEOUT_MS = 15_000;

/** The writing side: the register URL and the bouwer token; null when writing is off (no token). */
export function schrijfConfigFromEnv(env: Record<string, string | undefined> = process.env): { baseUrl: string; token: string } | null {
  const baseUrl = env.OMNIUM_REGISTER_URL?.trim().replace(/\/+$/, "");
  const token = env.OMNIUM_KOPPELING_TOKEN?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

export const kanKoppelingenSchrijven = (env: Record<string, string | undefined> = process.env) => schrijfConfigFromEnv(env) !== null;

/** A fresh Inrichting (no request cache): the state just before writing. */
function verse(fetcher?: typeof fetch): Inrichting | null {
  const config = registerConfigFromEnv();
  return config ? new Inrichting(new OmniumRegister({ ...config, fetch: fetcher ?? config.fetch })) : null;
}

const vandaagNL = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

export async function slaKoppelingOp(
  h: KoppelingHandeling,
  namens: string,
  opties: { fetch?: typeof fetch; vandaag?: string; env?: Record<string, string | undefined> } = {}
): Promise<KoppelingResultaat> {
  const schrijf = schrijfConfigFromEnv(opties.env);
  if (!schrijf) return { ok: false, fout: "Koppelingen opslaan staat uit: de site heeft (nog) geen schrijfaccount voor het register." };
  const fetcher = opties.fetch ?? fetch;
  const lees = verse(fetcher);
  if (!lees) return { ok: false, fout: "De site heeft geen register ingesteld." };

  let stand;
  try {
    stand = await vastgelegdeKoppelingen(lees);
  } catch {
    return { ok: false, fout: "Het register is niet te lezen; er is niets opgeslagen." };
  }
  const plan = planKoppeling(h, stand, opties.vandaag ?? vandaagNL());
  if (!plan.ok) return plan;
  if (!binnenWhitelist(plan.registratie)) return { ok: false, fout: "Deze wijziging valt buiten wat de site mag schrijven." };

  const registratie: Registratie = { ...plan.registratie, opmerking: `${plan.registratie.opmerking} (via Imprint, namens ${namens})` };
  try {
    const res = await fetcher(`${schrijf.baseUrl}/registratie/`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${schrijf.token}` },
      body: JSON.stringify({
        registratie: { opmerking: registratie.opmerking, registratietype: registratie.registratietype, bron: "imprint-omgevingswizard" },
        wijzigingen: registratie.wijzigingen,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, melding: "Opgeslagen in het register." };
    const tekst = await res.text().catch(() => "");
    return { ok: false, fout: `Het register weigerde (${res.status})${tekst ? `: ${tekst.slice(0, 300)}` : ""}.` };
  } catch {
    // Time-out or connection lost: it may have landed. Read again and look; never send it blindly again.
    const na = verse(fetcher);
    const opnieuw = na ? await vastgelegdeKoppelingen(na).catch(() => undefined) : undefined;
    if (opnieuw && isDoorgevoerd(h, opnieuw)) return { ok: true, melding: "Opgeslagen (na een time-out bevestigd door opnieuw te lezen)." };
    return {
      ok: false,
      fout: opnieuw
        ? "Geen antwoord van het register, en de wijziging staat er niet in. Probeer het opnieuw."
        : "Geen antwoord van het register; of de wijziging is aangekomen, is niet na te gaan. Ververs de pagina voordat je het opnieuw probeert.",
    };
  }
}
