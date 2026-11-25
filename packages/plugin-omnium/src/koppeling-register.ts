import type { Inrichting } from "./inrichting";
import { currentHubs, currentVersion, ge, type FullRecord } from "./register";

/**
 * Koppelingen in the register (schema v8, 25-11-2026): reading what is there,
 * and turning one action of the editor (draw, move, erase a line) into one
 * registration. Pure apart from `vastgelegdeKoppelingen` (reads through the
 * Inrichting); the POST is in koppeling-opslaan.ts.
 *
 * Rules (Fundament docs/inrichtingstool-als-plugin.md §9, BACKEND 25-11):
 *  - a Koppeling hangs on the e-dienstversie (`edienstversie_koppelingen`,
 *    keuze A), the same for every municipality;
 *  - a line counts only when the Koppeling itself is still in
 *    full/koppelingen (an afvoer of a Koppeling leaves the relation on the
 *    e-dienstversie behind, looking alive);
 *  - erase = afvoer of the Koppeling and, in the same registration, of every
 *    relation occurrence on an e-dienstversie that points at it;
 *  - move = an ordinary registration, not a correctie (only when the target
 *    already changed today: the register refuses a second aanvang on the
 *    same day, so then the occurrence of today is corrected);
 *  - no doubles: one fixed key per line (e-dienstversie + bronelement +
 *    doelcomponent), read just before saving.
 */

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

export type KoppelingBron = { rel_id: number; bronSoort: string; bronElementId: string; naampad?: string };

export type VastgelegdeKoppeling = {
  id: number;
  naam: string;
  omschrijving?: string;
  status?: string;
  bronnen: KoppelingBron[];
  doel?: { rel_id: number; component_id: number; apiPad?: string; aanvang?: string };
  transformatie?: { rel_id: number; transformatie_id: number };
  /** The e-dienstversies it hangs on, with the rel_id of that occurrence (needed to erase it). */
  edienstversies: { edienstversie_id: number; rel_id: number }[];
};

/** The hubs of a GE or relation with their rel_id and current values. */
function rijen(r: FullRecord | undefined, key: string): (Record<string, unknown> & { rel_id: number })[] {
  return currentHubs(r, key).flatMap((h) => {
    const v = currentVersion(h);
    const rel = num(h.rel_id) ?? num(v?.rel_id);
    return v && rel !== undefined ? [{ ...v, rel_id: rel }] : [];
  });
}

/** The live aanvang of a materieel occurrence (a list or one object), for the same-day rule. */
function aanvangVan(r: FullRecord | undefined, key: string, rel: number): string | undefined {
  const h = currentHubs(r, key).find((x) => (num(x.rel_id) ?? num(currentVersion(x)?.rel_id)) === rel);
  const a = h?.aanvang;
  const lijst = (Array.isArray(a) ? a : a ? [a] : []) as { datum?: string; afvoer?: string }[];
  return lijst.filter((x) => x?.datum && !x.afvoer).map((x) => x.datum!).sort().at(-1);
}

/** What the register holds: every live Koppeling with its sources, target, transformation and e-dienstversies. */
export async function vastgelegdeKoppelingen(i: Inrichting): Promise<VastgelegdeKoppeling[]> {
  const [koppelingen, versies] = await Promise.all([i.list("koppelingen").catch(() => []), i.list("edienstversies").catch(() => [])]);
  const opVersie = new Map<number, { edienstversie_id: number; rel_id: number }[]>();
  for (const v of versies)
    for (const l of rijen(v, "edienstversie_koppelingen")) {
      const k = num(l.koppeling_id);
      if (k !== undefined) opVersie.set(k, [...(opVersie.get(k) ?? []), { edienstversie_id: v.id, rel_id: l.rel_id }]);
    }
  return koppelingen.map((k) => {
    const doel = rijen(k, "koppeling_doelcomponenten")[0];
    const tr = rijen(k, "koppeling_transformaties")[0];
    return {
      id: k.id,
      naam: str(ge(k, "koppeling_namen")?.naam) ?? `Koppeling ${k.id}`,
      omschrijving: str(ge(k, "koppeling_namen")?.omschrijving),
      status: str(ge(k, "koppeling_verlopen")?.status),
      bronnen: rijen(k, "koppeling_bronnen").flatMap((b) =>
        str(b.bronElementId) ? [{ rel_id: b.rel_id, bronSoort: str(b.bronSoort) ?? "entiteit", bronElementId: str(b.bronElementId)!, naampad: str(b.naampad) }] : []
      ),
      doel:
        doel && num(doel.component_id) !== undefined
          ? { rel_id: doel.rel_id, component_id: num(doel.component_id)!, apiPad: str(doel.apiPad), aanvang: aanvangVan(k, "koppeling_doelcomponenten", doel.rel_id) }
          : undefined,
      transformatie: tr && num(tr.transformatie_id) !== undefined ? { rel_id: tr.rel_id, transformatie_id: num(tr.transformatie_id)! } : undefined,
      edienstversies: opVersie.get(k.id) ?? [],
    };
  });
}

// ── One action → one registration ──────────────────────────────────────────

export type KoppelingHandeling =
  | {
      soort: "nieuw";
      edienstversieId: number;
      naam: string;
      bron: { bronSoort: string; bronElementId: string; naampad?: string };
      componentId: number;
      apiPad?: string;
    }
  | { soort: "verleg-bron"; koppelingId: number; bron: { bronSoort: string; bronElementId: string; naampad?: string } }
  | { soort: "verleg-doel"; koppelingId: number; componentId: number }
  | { soort: "wis"; koppelingId: number };

export type Wijziging = { opvoer: Record<string, Record<string, unknown>> } | { afvoer: Record<string, Record<string, unknown>> };
export type Registratie = { opmerking: string; registratietype: "registratie" | "correctie"; wijzigingen: Wijziging[] };

/** The only things the site may write (whitelist on type names, §9): the Koppeling and its relation on the e-dienstversie. */
export const TOEGESTAAN = new Set([
  "koppeling",
  "koppeling_aanvang",
  "koppelingnaam",
  "koppelingbron",
  "koppelingdoelcomponent",
  "koppelingtransformatie",
  "koppelingverloop",
  "edienstversiekoppeling",
]);

export function binnenWhitelist(r: Registratie): boolean {
  return r.wijzigingen.length > 0 && r.wijzigingen.every((w) => Object.keys("opvoer" in w ? w.opvoer : w.afvoer).every((k) => TOEGESTAAN.has(k)));
}

/** The fixed key of a line: e-dienstversie + bronelement + doelcomponent. */
export const sleutel = (edienstversieId: number, bronElementId: string, componentId: number) => `${edienstversieId}|${bronElementId}|${componentId}`;

/** Every key the register has now (a Koppeling on several versions or with several sources has several). */
export function sleutels(stand: VastgelegdeKoppeling[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of stand)
    for (const v of k.edienstversies) for (const b of k.bronnen) if (k.doel) m.set(sleutel(v.edienstversie_id, b.bronElementId, k.doel.component_id), k.id);
  return m;
}

const zonderLeeg = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const NIEUW = "$nieuw.koppeling";

export type Plan = { ok: true; registratie: Registratie } | { ok: false; fout: string };

/**
 * One action as one registration, against the state read just before. A new
 * line whose key exists, or a move onto an existing key, is refused here: the
 * register does not deduplicate.
 */
export function planKoppeling(h: KoppelingHandeling, stand: VastgelegdeKoppeling[], vandaag: string): Plan {
  const bestaand = sleutels(stand);
  if (h.soort === "nieuw") {
    if (bestaand.has(sleutel(h.edienstversieId, h.bron.bronElementId, h.componentId)))
      return { ok: false, fout: "Deze koppeling bestaat al voor deze e-dienstversie." };
    if (!h.naam.trim()) return { ok: false, fout: "Geef de koppeling een naam." };
    return {
      ok: true,
      registratie: {
        opmerking: `Koppeling: ${h.naam.trim()}`,
        registratietype: "registratie",
        wijzigingen: [
          { opvoer: { koppeling: { id: NIEUW } } },
          { opvoer: { koppelingnaam: { koppeling_id: NIEUW, naam: h.naam.trim() } } },
          { opvoer: { koppeling_aanvang: { koppeling_id: NIEUW, datum: vandaag } } },
          { opvoer: { koppelingbron: zonderLeeg({ koppeling_id: NIEUW, ...h.bron }) } },
          { opvoer: { koppelingdoelcomponent: zonderLeeg({ koppeling_id: NIEUW, component_id: h.componentId, apiPad: h.apiPad }) } },
          { opvoer: { edienstversiekoppeling: { edienstversie_id: h.edienstversieId, koppeling_id: NIEUW } } },
        ],
      },
    };
  }
  const k = stand.find((x) => x.id === h.koppelingId);
  if (!k) return { ok: false, fout: "Deze koppeling staat niet (meer) in het register; ververs de pagina." };
  if (h.soort === "wis") {
    return {
      ok: true,
      registratie: {
        opmerking: `Koppeling gewist: ${k.naam}`,
        registratietype: "registratie",
        wijzigingen: [
          { afvoer: { koppeling: { id: k.id } } },
          ...k.edienstversies.map((v): Wijziging => ({ afvoer: { edienstversiekoppeling: { edienstversie_id: v.edienstversie_id, rel_id: v.rel_id } } })),
        ],
      },
    };
  }
  if (h.soort === "verleg-bron") {
    const oud = k.bronnen[0];
    if (oud?.bronElementId === h.bron.bronElementId) return { ok: false, fout: "De lijn ligt daar al." };
    if (k.doel && k.edienstversies.some((v) => bestaand.get(sleutel(v.edienstversie_id, h.bron.bronElementId, k.doel!.component_id)) !== undefined))
      return { ok: false, fout: "Daar ligt al een koppeling naar hetzelfde doel." };
    return {
      ok: true,
      registratie: {
        opmerking: `Koppeling verlegd (bron): ${k.naam}`,
        registratietype: "registratie",
        wijzigingen: [
          ...(oud ? [{ afvoer: { koppelingbron: { koppeling_id: k.id, rel_id: oud.rel_id } } } as Wijziging] : []),
          { opvoer: { koppelingbron: zonderLeeg({ koppeling_id: k.id, ...h.bron }) } },
        ],
      },
    };
  }
  // verleg-doel: a materieel enkelvoudig relation, so a successor with aanvang today; corrected when it already began today.
  if (k.doel?.component_id === h.componentId) return { ok: false, fout: "De lijn ligt daar al." };
  if (k.edienstversies.some((v) => k.bronnen.some((b) => bestaand.get(sleutel(v.edienstversie_id, b.bronElementId, h.componentId)) !== undefined)))
    return { ok: false, fout: "Daar ligt al een koppeling vanuit hetzelfde modelelement." };
  const vandaagBegonnen = k.doel?.aanvang?.slice(0, 10) === vandaag;
  return {
    ok: true,
    registratie: {
      opmerking: `Koppeling verlegd (doel): ${k.naam}`,
      registratietype: vandaagBegonnen ? "correctie" : "registratie",
      wijzigingen: [
        {
          opvoer: {
            koppelingdoelcomponent: vandaagBegonnen
              ? { koppeling_id: k.id, rel_id: k.doel!.rel_id, component_id: h.componentId }
              : k.doel
                ? { koppeling_id: k.id, component_id: h.componentId, aanvang: vandaag }
                : { koppeling_id: k.id, component_id: h.componentId },
          },
        },
      ],
    },
  };
}

/** After a time-out: did the action land? Read again and look for its effect (never send blindly again, §9). */
export function isDoorgevoerd(h: KoppelingHandeling, stand: VastgelegdeKoppeling[]): boolean {
  const k = "koppelingId" in h ? stand.find((x) => x.id === h.koppelingId) : undefined;
  switch (h.soort) {
    case "nieuw":
      return sleutels(stand).has(sleutel(h.edienstversieId, h.bron.bronElementId, h.componentId));
    case "wis":
      return !k;
    case "verleg-bron":
      return Boolean(k?.bronnen.some((b) => b.bronElementId === h.bron.bronElementId));
    case "verleg-doel":
      return k?.doel?.component_id === h.componentId;
  }
}

/** Component name → register id, for the view (which speaks names). */
export async function componentIds(i: Inrichting): Promise<Map<string, number>> {
  return new Map((await i.list("componenten").catch(() => [])).flatMap((c) => (i.componentNaam(c) ? [[i.componentNaam(c)!, c.id] as const] : [])));
}

/** For the e-dienstversie choice: every version with its title. */
export async function edienstversieKeuzes(i: Inrichting): Promise<{ id: number; label: string }[]> {
  const versies = await i.list("edienstversies").catch(() => []);
  const uit = await Promise.all(versies.map(async (v) => ({ id: v.id, label: await i.title("edienstversies", v) })));
  return uit.sort((a, b) => a.label.localeCompare(b.label, "nl", { numeric: true }));
}

