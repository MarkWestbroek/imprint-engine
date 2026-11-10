import type { FormulierActie } from "./formulier-acties";
import type { NeutralForm, Question, QuestionType } from "./neutral-form";

/**
 * The form of an e-dienst as the Studio keeps it (werkplaats-plan Fase B,
 * laag 2): a FormulierDefinitie in profile `formulierdiagram` (Omnium
 * FORMULIERDEFINITIES §2.6; adapter.js). Containers (formulier, stap,
 * conditioneel, lijst, groep, rij) are elements; a question is a compartment
 * row (`fieldType: "veld"`) of its container; a sub-container hangs under its
 * parent by a `bevat` connector. Rows and connectors of one parent share one
 * `volgorde` index (a string).
 *
 *  - `fdNaarNeutraal`: elements → the neutral form the werkplaats edits.
 *  - `actieNaarOps`: one werkplaats action → the ops for store
 *    `model:formulierdiagram`: one `patchElementen {zet, wis}` with whole
 *    elements (replaying never throws; a concurrent change elsewhere stays),
 *    plus `addElementToDiagram` for a new container (OMNIUM-UI 10-11).
 *
 * Field paths (OMNIUM-UI 10-11): `data.veld` is the path from the doeltype
 * with JSON role names (`Ent.rol.veld`); inside a `lijst` only the field name.
 * A condition names the other question by that path (`conditieVeld`), not by key.
 */

export type Rij = { naam: string; fieldType: string; data?: Record<string, unknown> };
export type StudioElement = {
  id: string;
  naam: string;
  elementType: string;
  compartimenten?: { compartmentType: string; velden?: Rij[] }[];
  data?: Record<string, unknown>;
  source?: string;
  target?: string;
};
export type Elementen = Record<string, StudioElement>;
export type Operatie = { store: string; op: string; args: unknown[] };

export const FD_STORE = "model:formulierdiagram";

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown, fallback: number) => (v !== "" && v != null && Number.isFinite(Number(v)) ? Number(v) : fallback);
const rijenVan = (el: StudioElement): Rij[] => el.compartimenten?.find((c) => c.compartmentType === "velden")?.velden ?? [];
const sleutel = (r: Rij) => str(r.data?.key) || str(r.data?.veld);

type Kind = { soort: "rij"; rij: Rij; i: number; volgorde: number } | { soort: "container"; el: StudioElement; bevat: StudioElement; volgorde: number };

/** The children of a container, rows and sub-containers together, in `volgorde` (as formulierModelNaarLayout merges them). */
export function kinderen(elements: Elementen, container: StudioElement): Kind[] {
  const rijen: Kind[] = rijenVan(container).map((rij, i) => ({ soort: "rij", rij, i, volgorde: num(rij.data?.volgorde, 1e6 + i) }));
  const subs: Kind[] = Object.values(elements)
    .filter((e) => e.elementType === "bevat" && e.source === container.id && e.target && elements[e.target])
    .map((b, i) => ({ soort: "container", el: elements[b.target!]!, bevat: b, volgorde: num(b.data?.volgorde, 2e6 + i) }));
  return [...rijen, ...subs].sort((a, b) => a.volgorde - b.volgorde);
}

/** The formulier root with this code (data.code), else the only one. */
export function formulierRoot(elements: Elementen, code?: string): StudioElement | undefined {
  const roots = Object.values(elements).filter((e) => e.elementType === "formulier");
  return (code && roots.find((r) => str(r.data?.code) === code)) || (roots.length === 1 ? roots[0] : undefined);
}

/** Where each question and step lives. */
export type Plek = {
  root: string;
  stappen: Map<string, string>;
  vragen: Map<string, { container: string; rij: number; stap: string; veld: string }>;
};

const VORM: Record<string, QuestionType> = { bestand: "file", tekstvak: "textarea", datum: "date", vinkje: "checkbox" };

/**
 * The FD as a neutral form: each `stap` a step, each row a question. A row in
 * a `conditioneel` gets its condition (the path resolved to the other
 * question's key); a row in a `lijst` with min ≥ 1 is required. The type is a
 * hint (the vorm, else text): the werkplaats takes the real one from the
 * generated form by key.
 */
export function fdNaarNeutraal(elements: Elementen, code?: string): { form: NeutralForm; plek: Plek } | undefined {
  const root = formulierRoot(elements, code);
  if (!root) return undefined;
  const plek: Plek = { root: root.id, stappen: new Map(), vragen: new Map() };
  const keyVanPad = new Map<string, string>();
  for (const e of Object.values(elements)) for (const r of rijenVan(e)) if (r.data?.key) keyVanPad.set(str(r.data.veld), str(r.data.key));

  const vragenIn = (c: StudioElement, stap: string, depth: number, cond?: Question["condition"], lijst?: { min: number }): Question[] =>
    kinderen(elements, c).flatMap((k): Question[] => {
      if (k.soort === "rij") {
        if (k.rij.fieldType !== "veld") return [];
        const d = k.rij.data ?? {};
        const key = sleutel(k.rij);
        const veld = str(d.veld);
        plek.vragen.set(key, { container: c.id, rij: k.i, stap, veld });
        return [
          {
            key,
            label: str(d.label) || k.rij.naam || key,
            type: VORM[str(d.vorm)] ?? "text",
            engineType: str(d.vorm) || "veld",
            required: d.verplicht === true || (lijst?.min ?? 0) > 0,
            readOnly: d.readonly === true,
            choices: [],
            condition: cond,
            depth,
            pointer: `/studio/${c.id}/${k.i}`,
            bron: { elementId: str(d.elementId) || undefined, veld: veld.split(".").at(-1) || undefined, pad: veld || undefined },
          },
        ];
      }
      const d = k.el.data ?? {};
      switch (k.el.elementType) {
        case "conditioneel": {
          const pad = str(d.conditieVeld);
          return vragenIn(k.el, stap, depth, { key: keyVanPad.get(pad) ?? pad, eq: str(d.conditieWaarde), show: true }, lijst);
        }
        case "lijst":
          return vragenIn(k.el, stap, depth, cond, { min: num(d.min, 0) });
        case "groep":
        case "rij":
          return vragenIn(k.el, stap, depth, cond, lijst);
        default:
          return []; // invoegen, notes: not questions of this form
      }
    });

  const steps: NeutralForm["steps"] = [];
  for (const k of kinderen(elements, root)) {
    if (k.soort !== "container" || k.el.elementType !== "stap") continue;
    const slug = str(k.el.data?.key) || k.el.id;
    plek.stappen.set(slug, k.el.id);
    steps.push({ title: k.el.naam && k.el.naam !== "Stap" ? k.el.naam : slug, slug, questions: vragenIn(k.el, slug, 0) });
  }
  return { form: { name: root.naam, login: [], steps }, plek };
}

// ── writing ───────────────────────────────────────────────────────────────

export class StudioFout extends Error {}

/** A new, unique element id ("frm_wp_<…>"); the caller makes them (time + counter, or a test sequence). */
export type NieuwId = (soort: string) => string;

/** The model as the write needs it: the elements, and the diagram new containers go on. */
export type FdModel = { elements: Elementen; diagramId?: string; posities?: Record<string, { x: number; y: number }> };

/**
 * A field path for a new question: given by the caller when known (`bron.pad`
 * in FD form, `Ent.rol.veld`); else derived from a question on the same model
 * element already in the form (same `Ent.rol.`, other field). Without either
 * the role name is unknown, and the action is refused rather than guessed.
 */
export function veldpadVoor(elements: Elementen, elementId: string, veld: string, pad?: string): string {
  if (pad && pad.split(".").length >= 2) return pad;
  for (const e of Object.values(elements))
    for (const r of rijenVan(e)) {
      const p = str(r.data?.veld);
      if (str(r.data?.elementId) === elementId && p.includes(".")) return `${p.split(".").slice(0, -1).join(".")}.${veld}`;
    }
  throw new StudioFout(`“${veld}” hoort niet bij deze aanvraag: het veldpad in het model is niet bekend.`);
}

/** Work on a copy; collect the changed elements and the removed ids. */
class Werk {
  zet: Elementen = {};
  wis = new Set<string>();
  nieuw: string[] = [];
  constructor(private readonly basis: Elementen) {}
  get elements(): Elementen {
    const all = { ...this.basis, ...this.zet };
    for (const id of this.wis) delete all[id];
    return all;
  }
  get(id: string): StudioElement {
    const e = this.elements[id];
    if (!e) throw new StudioFout(`Element ${id} ontbreekt.`);
    return e;
  }
  put(e: StudioElement) {
    this.zet[e.id] = e;
    this.wis.delete(e.id);
  }
  remove(id: string) {
    delete this.zet[id];
    this.wis.add(id);
  }
  /** Give a container these children, in this order: rows into its compartment, connectors renumbered. */
  order(containerId: string, lijst: Kind[]) {
    const c = structuredClone(this.get(containerId));
    const rijen: Rij[] = [];
    lijst.forEach((k, n) => {
      if (k.soort === "rij") rijen.push({ ...k.rij, data: { ...k.rij.data, volgorde: String(n) } });
      else if (str(k.bevat.data?.volgorde) !== String(n) || !(k.bevat.id in this.basis)) this.put({ ...structuredClone(k.bevat), data: { ...k.bevat.data, volgorde: String(n) } });
    });
    const comp = c.compartimenten?.find((x) => x.compartmentType === "velden");
    if (comp) comp.velden = rijen;
    else c.compartimenten = [...(c.compartimenten ?? []), { compartmentType: "velden", velden: rijen }];
    this.put(c);
  }
  kinderen(containerId: string) {
    return kinderen(this.elements, this.get(containerId));
  }
  /** Take a question's row out of its container; an emptied conditioneel goes too, with its connector. */
  take(key: string): Rij {
    const at = this.where(key);
    const c = this.get(at.container);
    const rij = rijenVan(c).find((r) => sleutel(r) === key)!;
    const rest = this.kinderen(c.id).filter((k) => !(k.soort === "rij" && sleutel(k.rij) === key));
    if (c.elementType === "conditioneel" && rest.length === 0) {
      const bevat = Object.values(this.elements).find((e) => e.elementType === "bevat" && e.target === c.id);
      this.remove(c.id);
      if (bevat) this.remove(bevat.id);
    } else this.order(c.id, rest);
    return rij;
  }
  where(key: string) {
    for (const e of Object.values(this.elements)) {
      const i = rijenVan(e).findIndex((r) => r.fieldType === "veld" && sleutel(r) === key);
      if (i >= 0) return { container: e.id, rij: i };
    }
    throw new StudioFout(`Vraag “${key}” staat niet (meer) in het formulier.`);
  }
}

/** The index after `na` (a question key) among children: the row itself, or the container holding it. Null = first; unknown = last. */
function naIndex(elements: Elementen, lijst: Kind[], na: string | null): number {
  if (na === null) return 0;
  const i = lijst.findIndex((k) =>
    k.soort === "rij" ? sleutel(k.rij) === na : kinderen(elements, k.el).some((x) => x.soort === "rij" && sleutel(x.rij) === na)
  );
  return i >= 0 ? i + 1 : lijst.length;
}

/**
 * The container in a step for a row with this condition: an existing
 * `conditioneel` with the same path and value, else a new one placed right
 * after the question it depends on.
 */
function containerVoor(w: Werk, stapId: string, cond: { pad: string; waarde: string; type?: string } | undefined, na: string | null, nieuwId: NieuwId): string {
  if (!cond) return stapId;
  const lijst = w.kinderen(stapId);
  const bestaand = lijst.find(
    (k) => k.soort === "container" && k.el.elementType === "conditioneel" && str(k.el.data?.conditieVeld) === cond.pad && str(k.el.data?.conditieWaarde) === cond.waarde
  );
  if (bestaand?.soort === "container") return bestaand.el.id;
  const id = nieuwId("conditioneel");
  const container: StudioElement = {
    id,
    naam: `als ${cond.pad.split(".").at(-1)} == ${cond.waarde}`,
    elementType: "conditioneel",
    compartimenten: [{ compartmentType: "velden", velden: [] }],
    data: { conditieVeld: cond.pad, conditieOp: "==", conditieWaarde: cond.waarde, ...(cond.type ? { conditieWaardeType: cond.type } : {}) },
  };
  const bevat: StudioElement = { id: nieuwId("bevat"), naam: "", elementType: "bevat", source: stapId, target: id, compartimenten: [], data: {} };
  w.put(container);
  w.nieuw.push(id);
  const at = naIndex(w.elements, lijst, na);
  w.order(stapId, [...lijst.slice(0, at), { soort: "container", el: container, bevat, volgorde: 0 }, ...lijst.slice(at)]);
  return id;
}

/** The ops of one action, against the FD as it is now. Throws `StudioFout` when it does not fit. */
export function actieNaarOps(model: FdModel, actie: FormulierActie, code: string | undefined, nieuwId: NieuwId): Operatie[] {
  const gelezen = fdNaarNeutraal(model.elements, code);
  if (!gelezen) throw new StudioFout("Er is geen formulier in dit project.");
  const { plek, form } = gelezen;
  const w = new Werk(model.elements);
  const stapId = (slug: string) => {
    const id = plek.stappen.get(slug);
    if (!id) throw new StudioFout(`Stap “${slug}” staat niet (meer) in het formulier.`);
    return id;
  };
  const vraag = (key: string) => {
    const v = plek.vragen.get(key);
    if (!v) throw new StudioFout(`Vraag “${key}” staat niet (meer) in het formulier.`);
    return v;
  };
  const zetRij = (key: string, f: (rij: Rij) => Rij) => {
    const at = w.where(key);
    w.order(at.container, w.kinderen(at.container).map((k) => (k.soort === "rij" && sleutel(k.rij) === key ? { ...k, rij: f(structuredClone(k.rij)) } : k)));
  };
  const isVinkje = (key: string) => form.steps.some((st) => st.questions.some((q) => q.key === key && q.type === "checkbox"));

  switch (actie.actie) {
    case "labelWijzigen":
      vraag(actie.vraag);
      zetRij(actie.vraag, (r) => ({ ...r, naam: actie.label, data: { ...r.data, label: actie.label } }));
      break;
    case "verplichtZetten":
      vraag(actie.vraag);
      zetRij(actie.vraag, (r) => ({ ...r, data: { ...r.data, verplicht: actie.verplicht } }));
      break;
    case "stapHernoemen": {
      const s = structuredClone(w.get(stapId(actie.stap)));
      w.put({ ...s, naam: actie.titel });
      break;
    }
    case "stapToevoegen": {
      if (plek.stappen.has(actie.stap)) throw new StudioFout(`Er is al een stap “${actie.stap}”.`);
      const id = nieuwId("stap");
      const stap: StudioElement = { id, naam: actie.titel, elementType: "stap", compartimenten: [{ compartmentType: "velden", velden: [] }], data: { key: actie.stap } };
      const bevat: StudioElement = { id: nieuwId("bevat"), naam: "", elementType: "bevat", source: plek.root, target: id, compartimenten: [], data: {} };
      w.put(stap);
      w.nieuw.push(id);
      const lijst = w.kinderen(plek.root);
      const at = actie.na === null ? 0 : lijst.findIndex((k) => k.soort === "container" && str(k.el.data?.key) === actie.na) + 1 || lijst.length;
      w.order(plek.root, [...lijst.slice(0, at), { soort: "container", el: stap, bevat, volgorde: 0 }, ...lijst.slice(at)]);
      break;
    }
    case "vraagVerwijderen":
      vraag(actie.vraag);
      w.take(actie.vraag);
      break;
    case "vraagToevoegen": {
      if (plek.vragen.has(actie.vraag)) throw new StudioFout(`Er is al een vraag “${actie.vraag}”.`);
      const s = stapId(actie.stap);
      const veld = veldpadVoor(model.elements, actie.bron.elementId, actie.bron.veld, actie.bron.pad);
      const rij: Rij = { naam: actie.label, fieldType: "veld", data: { veld, key: actie.vraag, label: actie.label, elementId: actie.bron.elementId } };
      const lijst = w.kinderen(s);
      const at = naIndex(w.elements, lijst, actie.na);
      w.order(s, [...lijst.slice(0, at), { soort: "rij", rij, i: -1, volgorde: 0 }, ...lijst.slice(at)]);
      break;
    }
    case "vraagVerplaatsen": {
      const v = vraag(actie.vraag);
      const van = w.get(v.container);
      const cond =
        van.elementType === "conditioneel"
          ? { pad: str(van.data?.conditieVeld), waarde: str(van.data?.conditieWaarde), type: str(van.data?.conditieWaardeType) || undefined }
          : undefined;
      const rij = w.take(actie.vraag);
      const doel = containerVoor(w, stapId(actie.stap), cond, actie.na, nieuwId);
      const lijst = w.kinderen(doel);
      const at = doel === stapId(actie.stap) ? naIndex(w.elements, lijst, actie.na) : actie.na === null ? 0 : naIndex(w.elements, lijst, actie.na);
      w.order(doel, [...lijst.slice(0, at), { soort: "rij", rij, i: -1, volgorde: 0 }, ...lijst.slice(at)]);
      break;
    }
    case "voorwaardeZetten": {
      const v = vraag(actie.vraag);
      const stap = stapId(v.stap);
      // Where the question stands in its step now (itself, or the conditioneel holding it): without a condition it returns there.
      const plaats = naIndex(w.elements, w.kinderen(stap), actie.vraag) - 1;
      const rij = w.take(actie.vraag);
      const c = actie.voorwaarde;
      // The condition names the other question by its field path, as the renderer evaluates it.
      const cond = c ? { pad: vraag(c.vraag).veld, waarde: c.gelijkAan, type: isVinkje(c.vraag) ? "boolean" : undefined } : undefined;
      const doel = containerVoor(w, stap, cond, c?.vraag ?? null, nieuwId);
      const lijst = w.kinderen(doel);
      const at = doel === stap ? Math.min(Math.max(plaats, 0), lijst.length) : lijst.length;
      w.order(doel, [...lijst.slice(0, at), { soort: "rij", rij, i: -1, volgorde: 0 }, ...lijst.slice(at)]);
      break;
    }
  }

  // A removed container goes by deleteElement: it cascades to its connector and its node on the diagrams
  // (patchElementen does not cascade and would leave a node behind).
  const containers = [...w.wis].filter((id) => model.elements[id]?.elementType !== "bevat");
  const viaContainer = new Set(Object.values(model.elements).filter((e) => e.elementType === "bevat" && containers.includes(e.target ?? "")).map((e) => e.id));
  const ops: Operatie[] = [];
  if (Object.keys(w.zet).length || [...w.wis].some((id) => !containers.includes(id) && !viaContainer.has(id)))
    ops.push({ store: FD_STORE, op: "patchElementen", args: [{ zet: w.zet, wis: [...w.wis].filter((id) => !containers.includes(id) && !viaContainer.has(id)) }] });
  for (const id of containers) ops.push({ store: FD_STORE, op: "deleteElement", args: [id] });
  // A new container on the form's diagram, below its parent (OMNIUM-UI: no nodeId for a first occurrence).
  if (model.diagramId)
    for (const id of w.nieuw) {
      const ouder = Object.values(w.elements).find((e) => e.elementType === "bevat" && e.target === id)?.source;
      const p = (ouder && model.posities?.[ouder]) || { x: 40, y: 40 };
      ops.push({ store: FD_STORE, op: "addElementToDiagram", args: [model.diagramId, id, { x: p.x + 40, y: p.y + 200 }] });
    }
  return ops;
}
