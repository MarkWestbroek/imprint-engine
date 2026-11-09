import { ge, geRows, type FullRecord } from "./register";
import type { Inrichting } from "./inrichting";
import { fromFormio, fromNeutraal, obj, arr, s, type NeutralForm } from "./neutral-form";

/**
 * The werkplaats of an e-dienstversie (werkplaats-plan §3, Fase A): what the
 * seven steps show, read from the register. React-free, so it is testable and
 * the page and its widgets share one load.
 *
 *  - The stappenbalk is derived, not stored: a step is done when the register
 *    has what it makes (a form with traceregels, processes, a generation, a
 *    successful uitrol). Storing it belongs to Fase B, on the e-dienstversie.
 *  - The uitsnede is the set of model elements the traceregels of this
 *    version's results point at (`bronElementId`), as far as the drawings of
 *    the logical model show them.
 *  - "Deze keuze raakt": per model field, the results whose traceregels come
 *    from it.
 */

export const STAPPEN = [
  { slug: "basis", titel: "Basis kiezen" },
  { slug: "specialiseren", titel: "Specialiseren" },
  { slug: "velden", titel: "Velden en vragen" },
  { slug: "proces", titel: "Proces en regels" },
  { slug: "voorbeeld", titel: "Voorbeeld" },
  { slug: "genereren", titel: "Genereren" },
  { slug: "uitrollen", titel: "Uitrollen" },
] as const;
export type Stap = (typeof STAPPEN)[number]["slug"];
export const isStap = (x: string | undefined): x is Stap => STAPPEN.some((st) => st.slug === x);
/** Where `/werkplaats` without a step lands. */
export const EERSTE_STAP: Stap = "velden";

export type StapStand = "klaar" | "open" | "nog-niet";

export type Artefact = {
  record: FullRecord;
  title: string;
  soort?: string;
  richting: "gegenereerd" | "bron" | "weergave";
  component?: string;
  href?: string;
};

export type Trace = { bronGE?: string; bronElementId?: string; doelPad?: string; regel?: string };

/** A field of the model: its element in the drawing and the field name (the last part of bronGE). */
export type ModelVeld = { id: string; veld?: string; bronGE?: string };

/** The key of a model field across artefacts: the element and the field, else the path by name. */
export const veldSleutel = (t: Trace): string | undefined => {
  const last = t.bronGE?.split(".").at(-1);
  if (t.bronElementId) return `${t.bronElementId}|${(t.bronGE?.split(".").length ?? 0) >= 3 ? last : ""}`;
  return t.bronGE ? `ge:${t.bronGE}` : undefined;
};

/** A drawing: per element id its type, and its name as drawn. */
export type Tekening = { record: FullRecord; title: string; href?: string; svg: string; ids: Map<string, string>; labels: Map<string, string> };

export type WerkplaatsData = {
  versie: FullRecord;
  artefacten: Artefact[];
  resultaten: Artefact[];
  formulier?: Artefact;
  /** The form, neutral: the `formulier-neutraal` artefact when TRANSFORMATIES made one, else the Open Formulieren export (formio adapter). */
  form?: NeutralForm;
  /** The form's traceregels by JSON pointer. */
  formTraces: Map<string, Trace>;
  /** The e-dienstmodel (the source of steps 1–4), parsed. */
  edienstmodel?: Record<string, unknown>;
  /** The drawings of the logical model: element id → element type. */
  modelTekeningen: Tekening[];
  /** The drawings of the processes and decisions. */
  procesTekeningen: Tekening[];
  /** Per model element (in a drawing of the logical model) the fields used, from all results' traceregels. */
  uitsnede: Map<string, Set<string>>;
  /** Per model element what the e-dienstmodel chose and left out (its traceregels: actie gekozen/weggelaten). */
  keuzes: Map<string, { gekozen: Set<string>; weggelaten: Set<string> }>;
  /** Per model element its fields (regel modelveld) left out: what could be added to the form later. */
  weggelatenVelden: Map<string, string[]>;
  /** Fields (regel modelveld) chosen and left out. */
  telling: { gekozen: number; weggelaten: number };
  /** Per model field (`veldSleutel`) the results that come from it, with the traceregels. */
  raakt: Map<string, { artefact: Artefact; traces: Trace[] }[]>;
  uitrollen: FullRecord[];
  stand: Record<Stap, StapStand>;
};

const parse = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const traceOf = (t: Record<string, unknown>): Trace => ({
  bronGE: typeof t.bronGE === "string" ? t.bronGE : undefined,
  bronElementId: typeof t.bronElementId === "string" && t.bronElementId ? t.bronElementId : undefined,
  doelPad: typeof t.doelPad === "string" ? t.doelPad : undefined,
  regel: typeof t.regel === "string" ? t.regel : undefined,
});

/** The elements of a drawing: `data-element-id` → `data-element-type`, from the render service's `<g>` tags. */
export function elementsOf(svg: string): Map<string, string> {
  return new Map([...elementTags(svg)].map(([id, x]) => [id, x.type]));
}

/** Per element: its type and its name as drawn (the first text that is not a «stereotype»). */
export function elementTags(svg: string): Map<string, { type: string; label?: string }> {
  const out = new Map<string, { type: string; label?: string }>();
  for (const m of svg.matchAll(/<g\b[^>]*\bdata-element-id="[^"]+"[^>]*>/g)) {
    const tag = m[0];
    const id = /data-element-id="([^"]+)"/.exec(tag)?.[1];
    if (!id || out.has(id)) continue;
    const after = svg.slice(m.index + tag.length, m.index + tag.length + 4000);
    const label = [...after.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]!.trim()).find((x) => x && !x.startsWith("«"));
    out.set(id, { type: /data-element-type="([^"]+)"/.exec(tag)?.[1] ?? "", label });
  }
  return out;
}

export async function werkplaatsData(i: Inrichting, versie: FullRecord): Promise<WerkplaatsData> {
  const ofVersie: FullRecord[] = [];
  for (const a of await i.list("artefacten")) if ((await i.versieOfArtefact(a))?.id === versie.id) ofVersie.push(a);

  const artefacten: Artefact[] = await Promise.all(
    ofVersie.map(async (record) => {
      const [soort, richting, component, title, href] = await Promise.all([
        i.soortcode(record),
        i.richting(record),
        i.componentOfArtefact(record),
        i.title("artefacten", record),
        i.href("artefacten", record),
      ]);
      return { record, soort, richting, component: i.componentNaam(component), title, href };
    })
  );
  const resultaten = artefacten.filter((a) => a.richting === "gegenereerd");
  const formulier = resultaten.find((a) => a.soort === "formulier");
  // The neutral form wins: its questions point into its own payload, and so do its traceregels.
  const neutraal = resultaten.find((a) => a.soort === "formulier-neutraal");
  const neutraalForm = neutraal ? fromNeutraal(parse(ge(neutraal.record, "artefact_inhouden")?.payload)) : undefined;
  const bron = neutraalForm ? neutraal : formulier;
  const form = neutraalForm ?? (formulier ? fromFormio(parse(ge(formulier.record, "artefact_inhouden")?.payload), formulier.title) : undefined);
  const formTraces = new Map<string, Trace>(
    bron ? geRows(bron.record, "artefact_traceregels").map((t) => [s(t.doelPad), traceOf(t)] as const) : []
  );
  const model = artefacten.find((a) => a.soort === "edienstmodel");
  const edienstmodel = model ? obj(parse(ge(model.record, "artefact_inhouden")?.payload)) : undefined;

  // Drawings: the weergaven of the logical model and of the process and decision sources.
  const tekening = async (a: Artefact): Promise<Tekening | undefined> => {
    const svg = ge(a.record, "artefact_inhouden")?.payload;
    if (typeof svg !== "string" || !svg.includes("<svg")) return undefined;
    const tags = elementTags(svg);
    return {
      record: a.record,
      title: a.title,
      href: a.href,
      svg,
      ids: new Map([...tags].map(([id, x]) => [id, x.type])),
      labels: new Map([...tags].flatMap(([id, x]) => (x.label ? [[id, x.label] as const] : []))),
    };
  };
  const bronSoort = new Map(artefacten.filter((a) => a.richting === "bron").map((a) => [a.record.id, a.soort] as const));
  const modelTekeningen: Tekening[] = [];
  const procesTekeningen: Tekening[] = [];
  for (const a of artefacten.filter((x) => x.richting === "weergave")) {
    const bron = i.bronnenVan(a.record).find((b) => b.rol === "weergave-van");
    const t = await tekening(a);
    if (!t || !bron) continue;
    (bronSoort.get(bron.id) === "logisch-model" ? modelTekeningen : procesTekeningen).push(t);
  }
  modelTekeningen.sort((x, y) => x.ids.size - y.ids.size);

  // The uitsnede and what each field touches.
  const inModel = new Set(modelTekeningen.flatMap((t) => [...t.ids.keys()]));
  const uitsnede = new Map<string, Set<string>>();
  const raakt = new Map<string, { artefact: Artefact; traces: Trace[] }[]>();
  for (const a of resultaten) {
    for (const row of geRows(a.record, "artefact_traceregels")) {
      const t = traceOf(row);
      if (t.bronElementId && inModel.has(t.bronElementId)) {
        const set = uitsnede.get(t.bronElementId) ?? new Set<string>();
        const parts = t.bronGE?.split(".") ?? [];
        if (parts.length >= 3) set.add(parts.at(-1)!);
        uitsnede.set(t.bronElementId, set);
      }
      const key = veldSleutel(t);
      if (!key) continue;
      const list = raakt.get(key) ?? [];
      const hit = list.find((x) => x.artefact === a);
      if (hit) hit.traces.push(t);
      else list.push({ artefact: a, traces: [t] });
      raakt.set(key, list);
    }
  }

  // What the e-dienstmodel chose from the model, and what it left out (TRANSFORMATIES, generation 2026-11-09a):
  // its traceregels with actie gekozen/weggelaten, regel modelveld (a field) or modelwaarde (an enum value).
  const keuzes = new Map<string, { gekozen: Set<string>; weggelaten: Set<string> }>();
  const telling = { gekozen: 0, weggelaten: 0 };
  const weggelatenVelden = new Map<string, string[]>();
  for (const row of model ? geRows(model.record, "artefact_traceregels") : []) {
    const t = traceOf(row);
    const actie = s(row.actie);
    if (!t.bronElementId || (actie !== "gekozen" && actie !== "weggelaten")) continue;
    const veld = t.bronGE?.split(".").at(-1) ?? "";
    const k = keuzes.get(t.bronElementId) ?? { gekozen: new Set<string>(), weggelaten: new Set<string>() };
    k[actie].add(veld);
    keuzes.set(t.bronElementId, k);
    if (s(row.regel) === "modelveld") {
      telling[actie]++;
      if (actie === "weggelaten" && veld) weggelatenVelden.set(t.bronElementId, [...(weggelatenVelden.get(t.bronElementId) ?? []), veld]);
    }
    // A chosen field belongs to the uitsnede, also when no result reads it yet.
    if (actie === "gekozen" && inModel.has(t.bronElementId)) {
      const set = uitsnede.get(t.bronElementId) ?? new Set<string>();
      if (veld) set.add(veld);
      uitsnede.set(t.bronElementId, set);
    }
  }

  const uitrollen: FullRecord[] = [];
  for (const u of await i.list("uitrollen")) if ((await i.versieOfUitrol(u))?.id === versie.id) uitrollen.push(u);
  const geslaagd = uitrollen.some((u) => s(ge(u, "uitrol_verlopen")?.status) === "geslaagd");
  const hasProces = resultaten.some((a) => a.soort === "bpmn" || a.soort === "dmn");

  return {
    versie,
    artefacten,
    resultaten,
    formulier,
    form,
    formTraces,
    edienstmodel,
    modelTekeningen,
    procesTekeningen,
    uitsnede,
    keuzes,
    weggelatenVelden,
    telling,
    raakt,
    uitrollen,
    stand: {
      // No catalogue of bases and patterns yet (Fase B): these steps cannot be done or open.
      basis: "nog-niet",
      specialiseren: "nog-niet",
      velden: formTraces.size ? "klaar" : "open",
      proces: hasProces ? "klaar" : "open",
      voorbeeld: form ? "klaar" : "open",
      genereren: resultaten.length ? "klaar" : "open",
      uitrollen: geslaagd ? "klaar" : "open",
    },
  };
}

/** The form's steps as the e-dienstmodel chooses them (the thing step 3 will edit in Fase B). */
export type ModelStap = { naam: string; slug?: string; velden: { veld: string; key: string; label: string; verplicht: boolean; toonAls?: Record<string, unknown>; component?: string }[] };

export function modelStappen(edienstmodel: Record<string, unknown> | undefined): { stappen: ModelStap[]; registratie: Record<string, unknown> } {
  const formulier = obj(arr<Record<string, unknown>>(edienstmodel?.artefacten).find((a) => a.soort === "formulier"));
  return {
    stappen: arr<Record<string, unknown>>(formulier.stappen).map((st) => ({
      naam: s(st.naam),
      slug: s(st.slug) || undefined,
      velden: arr<Record<string, unknown>>(st.velden).map((v) => ({
        veld: s(v.veld),
        key: s(v.key),
        label: s(v.label),
        verplicht: Boolean(v.verplicht),
        toonAls: v.toonAls && typeof v.toonAls === "object" ? (v.toonAls as Record<string, unknown>) : undefined,
        component: s(v.component) || undefined,
      })),
    })),
    registratie: obj(formulier.registratie),
  };
}
