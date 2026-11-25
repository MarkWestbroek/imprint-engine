import { OmniumRegister, registerConfigFromEnv } from "./client";
import { Inrichting } from "./inrichting";
import { binnenWhitelist, isDoorgevoerd, leesWeigering, planKoppeling, vastgelegdeKoppelingen, type KoppelingHandeling, type Registratie } from "./koppeling-register";
import { COMPONENT_TOEGESTAAN, controleerOpname, LAGEN, planComponent, type Opname } from "./component-opname";

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
    return { ok: false, fout: leesWeigering(res.status, await res.text().catch(() => "")) };
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

/** The names of the Components now in the register (fresh read). */
async function componentNamen(i: Inrichting): Promise<string[]> {
  return (await i.list("componenten")).map((c) => i.componentNaam(c) ?? "").filter(Boolean);
}

/**
 * Take an unrecognised workload into the register as a new Component (step 3),
 * as one registration with the same writing account. Checked here once more,
 * against a fresh read: the register itself only enforces the unique name.
 * After a time-out: read again and look for the name; never resend blindly.
 */
export async function slaComponentOp(
  o: Opname,
  namens: string,
  opties: { fetch?: typeof fetch; vandaag?: string; env?: Record<string, string | undefined> } = {}
): Promise<KoppelingResultaat> {
  const schrijf = schrijfConfigFromEnv(opties.env);
  if (!schrijf) return { ok: false, fout: "Opnemen in het register staat uit: de site heeft (nog) geen schrijfaccount voor het register." };
  const fetcher = opties.fetch ?? fetch;
  const lees = verse(fetcher);
  if (!lees) return { ok: false, fout: "De site heeft geen register ingesteld." };

  let namen: string[];
  try {
    namen = await componentNamen(lees);
  } catch {
    return { ok: false, fout: "Het register is niet te lezen; er is niets opgeslagen." };
  }
  const fouten = controleerOpname(o, { bestaandeNamen: namen, lagen: [...LAGEN] }).filter((b) => b.ernst === "fout");
  if (fouten.length) return { ok: false, fout: fouten.map((b) => b.melding).join(" ") };
  const plan = planComponent(o, opties.vandaag ?? vandaagNL());
  if (!binnenWhitelist(plan, COMPONENT_TOEGESTAAN)) return { ok: false, fout: "Deze wijziging valt buiten wat de site mag schrijven." };

  try {
    const res = await fetcher(`${schrijf.baseUrl}/registratie/`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${schrijf.token}` },
      body: JSON.stringify({
        registratie: { opmerking: `${plan.opmerking} (via Imprint, namens ${namens})`, registratietype: plan.registratietype, bron: "imprint-omgevingswizard" },
        wijzigingen: plan.wijzigingen,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, melding: `${o.weergavenaam.trim()} staat in het register.` };
    return { ok: false, fout: leesWeigering(res.status, await res.text().catch(() => "")) };
  } catch {
    const na = verse(fetcher);
    const opnieuw = na ? await componentNamen(na).catch(() => undefined) : undefined;
    if (opnieuw?.includes(o.naam.trim())) return { ok: true, melding: "Opgenomen (na een time-out bevestigd door opnieuw te lezen)." };
    return {
      ok: false,
      fout: opnieuw
        ? "Geen antwoord van het register, en de component staat er niet in. Probeer het opnieuw."
        : "Geen antwoord van het register; of de component is aangekomen, is niet na te gaan. Ververs de pagina voordat je het opnieuw probeert.",
    };
  }
}
