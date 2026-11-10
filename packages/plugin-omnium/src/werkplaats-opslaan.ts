import { FormulierActie } from "./formulier-acties";
import type { Inrichting } from "./inrichting";
import type { NeutralForm } from "./neutral-form";
import { ge, type FullRecord } from "./register";
import { leesFd, OmniumStudio, OnbekendeOp, speelNa, StudioError, studioConfigFromEnv, type FdStand, type ProjectMeta } from "./studio-client";
import { actieNaarOps, fdNaarNeutraal, StudioFout } from "./studio-formulier";
import { werkplaatsData, type WerkplaatsData } from "./werkplaats";

/**
 * Saving the werkplaats form (Fase B, laag 2; Mark 10-11-2026): every action
 * the editor collected becomes one batch of ops on the dienstversie's branch
 * of the Studio project. One branch per dienstversie, made at the first save
 * (POST …/afsplitsen with the dienst's map); found again by its parent, its
 * map and its name. Merging into the main project is step 2 of branching, not
 * here: a saved branch is visible in the Studio and in "Verschil met MAIN".
 */

export type OpslaanResultaat =
  | { ok: true; opgeslagen: number; branch: string; nieuweBranch: boolean }
  | { ok: false; opgeslagen: number; fout: string; branch?: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Where the form lives in the Studio, from the register: the project the generation read, and the form's code. */
export function bronVan(i: Inrichting, data: WerkplaatsData): { project?: string; code?: string } {
  const f = data.formulier?.record;
  return { project: str(ge(f, "artefact_herkomsten")?.studioProjectId) || undefined, code: f ? i.identifier(f) : undefined };
}

/** The branch's name: one per dienstversie. */
export async function branchNaam(i: Inrichting, versie: FullRecord): Promise<string> {
  return `Werkplaats ${await i.title("edienstversies", versie)}`;
}

/** The map of the form's diagram in the project (`structuur.plaatsing`, key "formulierdiagram::<diagram>"). */
const mapVan = (stand: FdStand) => (stand.diagramId ? stand.plaatsing[`formulierdiagram::${stand.diagramId}`] : undefined);

/**
 * The dienstversie's branch: the open one of this project for the form's map,
 * whatever its name (Omnium allows one per parent and map; it may have been
 * made in the Studio). Without a known map: by name.
 */
export async function vindBranch(studio: OmniumStudio, hoofd: string, naam: string, mapId?: string): Promise<ProjectMeta | undefined> {
  return (await studio.projecten())
    .filter((p) => p.herkomst && p.herkomst.ouderProject === hoofd && !p.herkomst.gearchiveerd && (mapId ? p.herkomst.mapId === mapId : p.naam === naam))
    .sort((a, b) => str(b.herkomst?.afgesplitstOp).localeCompare(str(a.herkomst?.afgesplitstOp)))[0];
}

/**
 * A new question's field must be a field of this aanvraag in the logical model
 * (the doeltype and what it inherits); its path is taken from the model, never
 * from the browser. Returns the refusal, or undefined.
 */
export function controleerVeld(actie: FormulierActie, data: WerkplaatsData): string | undefined {
  if (actie.actie !== "vraagToevoegen") return undefined;
  const mv = data.modelVelden.get(actie.bron.elementId)?.find((v) => v.veld === actie.bron.veld);
  if (!mv) return `“${actie.bron.veld}” staat niet in het logisch model.`;
  if (!data.eigenEntiteiten.has(mv.eigenaar)) return `“${actie.bron.veld}” hoort niet bij deze aanvraag (een veld van ${mv.eigenaar}).`;
  actie.bron.pad = mv.pad;
  return undefined;
}

/** The form in the branch as a neutral form, types and choices taken from the generated form (by key) or the model. */
export function formUitStand(stand: FdStand, code: string | undefined, data: WerkplaatsData): NeutralForm | undefined {
  const gelezen = fdNaarNeutraal(stand.elements, code);
  if (!gelezen) return undefined;
  const gegenereerd = new Map((data.form?.steps ?? []).flatMap((st) => st.questions).map((q) => [q.key, q] as const));
  return {
    ...gelezen.form,
    login: data.form?.login ?? [],
    steps: gelezen.form.steps.map((st) => ({
      ...st,
      questions: st.questions.map((q) => {
        const g = gegenereerd.get(q.key);
        const mv = q.bron?.elementId ? data.modelVelden.get(q.bron.elementId)?.find((v) => v.veld === q.bron?.veld) : undefined;
        const type = g?.type ?? mv?.type ?? q.type;
        return { ...q, type, engineType: g?.engineType ?? mv?.soort ?? q.engineType, choices: g?.choices.length ? g.choices : (mv?.choices ?? q.choices) };
      }),
    })),
  };
}

/** What the edit page shows: the branch's form when there is one (and how far it is), else nothing (the register's form). */
export async function leesWerkplaatsBranch(
  i: Inrichting,
  versie: FullRecord,
  data: WerkplaatsData
): Promise<{ kanOpslaan: boolean; branch?: { id: string; naam: string; laatste: number; form?: NeutralForm }; fout?: string }> {
  const cfg = studioConfigFromEnv();
  const { project, code } = bronVan(i, data);
  if (!cfg) return { kanOpslaan: false, fout: "het schrijfaccount voor de Studio is op deze site nog niet ingericht." };
  if (!project) return { kanOpslaan: false, fout: "Het register zegt niet uit welk Studio-project dit formulier komt (ArtefactHerkomst.studioProjectId)." };
  const studio = new OmniumStudio(cfg);
  try {
    const b = await vindBranch(studio, project, await branchNaam(i, versie), mapVan(await leesFd(studio, project)));
    if (!b) return { kanOpslaan: true };
    const stand = await leesFd(studio, b.id);
    return { kanOpslaan: true, branch: { id: b.id, naam: b.naam, laatste: stand.laatste, form: formUitStand(stand, code, data) } };
  } catch (e) {
    return { kanOpslaan: false, fout: e instanceof StudioError || e instanceof OnbekendeOp ? e.message : "De Studio is niet bereikbaar." };
  }
}

/**
 * Save: find or make the branch, then per action one batch with the expected
 * sequence number and `namens`. On a 409 (someone else wrote) read again and
 * try that action once more on the new state. Stops at the first action that
 * no longer fits, and says how many were saved.
 */
export async function slaWerkplaatsOp(i: Inrichting, versie: FullRecord, ruw: unknown[], namens: string, studio?: OmniumStudio): Promise<OpslaanResultaat> {
  const cfg = studioConfigFromEnv();
  if (!studio && !cfg) return { ok: false, opgeslagen: 0, fout: "Opslaan is op deze site niet ingericht (geen schrijfaccount)." };
  studio ??= new OmniumStudio(cfg!);
  const acties = ruw.map((a) => FormulierActie.safeParse(a));
  const ongeldig = acties.findIndex((a) => !a.success);
  if (ongeldig >= 0) return { ok: false, opgeslagen: 0, fout: `Wijziging ${ongeldig + 1} is niet geldig.` };
  if (!acties.length) return { ok: false, opgeslagen: 0, fout: "Er is niets om op te slaan." };

  const data = await werkplaatsData(i, versie);
  const { project, code } = bronVan(i, data);
  if (!project) return { ok: false, opgeslagen: 0, fout: "Het register zegt niet uit welk Studio-project dit formulier komt." };
  for (const [k, a] of acties.entries()) {
    const fout = controleerVeld(a.data!, data);
    if (fout) return { ok: false, opgeslagen: 0, fout: `Wijziging ${k + 1}: ${fout}` };
  }
  const naam = await branchNaam(i, versie);
  let opgeslagen = 0;
  let branchId: string | undefined;
  try {
    const hoofd = await leesFd(studio, project);
    let branch = await vindBranch(studio, project, naam, mapVan(hoofd));
    let nieuweBranch = false;
    if (!branch) {
      try {
        branch = await studio.afsplitsen(project, { naam, mapId: mapVan(hoofd) });
        nieuweBranch = true;
      } catch (e) {
        // One open branch per parent and map (Omnium API): someone made it already, perhaps in the Studio. Write there.
        if (!(e instanceof StudioError && e.reden === "branch_bestaat" && e.projectId)) throw e;
        const id = e.projectId;
        branch = (await studio.projecten()).find((p) => p.id === id) ?? { id, naam: id };
      }
    }
    branchId = branch.id;
    let stand = await leesFd(studio, branch.id);
    const clientId = `imprint-werkplaats-${Date.now().toString(36)}`;
    let n = 0;
    const nieuwId = (soort: string) => `frm_wp_${Date.now().toString(36)}_${soort}_${++n}`;
    for (const a of acties) {
      const actie = a.data!;
      for (let poging = 0; ; poging++) {
        const ops = actieNaarOps(stand, actie, code, nieuwId);
        try {
          const r = await studio.schrijf(branch.id, { clientId, ops, verwachtLaatsteVolgnummer: stand.laatste, namens });
          const diagrams = stand.diagramId ? { [stand.diagramId]: { nodes: Object.entries(stand.posities).map(([elementId, position]) => ({ elementId, position })) } } : {};
          const s = { elements: stand.elements, diagrams, plaatsing: stand.plaatsing };
          speelNa(s, ops);
          stand = { ...stand, elements: s.elements, laatste: r.tot };
          opgeslagen++;
          break;
        } catch (e) {
          if (e instanceof StudioError && e.reden === "volgnummer_verschoven" && poging === 0) {
            stand = await leesFd(studio, branch.id);
            continue;
          }
          throw e;
        }
      }
    }
    return { ok: true, opgeslagen, branch: branch.naam, nieuweBranch };
  } catch (e) {
    const fout = e instanceof StudioFout || e instanceof StudioError || e instanceof OnbekendeOp ? e.message : "Opslaan is mislukt.";
    return { ok: false, opgeslagen, fout: opgeslagen ? `${opgeslagen} van ${acties.length} wijzigingen opgeslagen; daarna: ${fout}` : fout, branch: branchId };
  }
}

/**
 * The server action's body, for the site's one-line "use server" wrapper: the
 * version by its key path, the actions, and who saves (`namens`). The site
 * checks the role before calling this.
 */
export async function slaOpVoorPad(pad: string[], acties: unknown[], namens: string, prefix = "/inrichting"): Promise<OpslaanResultaat> {
  const { inrichtingFor } = await import("./context");
  const i = inrichtingFor(prefix);
  if (!i) return { ok: false, opgeslagen: 0, fout: "Deze site heeft geen register." };
  const located = await i.locate(pad).catch(() => null);
  if (!located || located.pad !== "edienstversies") return { ok: false, opgeslagen: 0, fout: "Deze e-dienstversie bestaat niet (meer)." };
  return slaWerkplaatsOp(i, located.record, Array.isArray(acties) ? acties : [], namens);
}
