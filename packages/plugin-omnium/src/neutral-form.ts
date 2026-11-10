/**
 * A form, neutral of the form engine that runs it (werkplaats-plan §4A, Mark
 * 9-11-2026): steps, questions, type, required, a condition, choices, and
 * where a question sits in the payload. Open Formulieren is one target; OWC on
 * WordPress and Nextcloud Forms are others. The werkplaats renders from this,
 * never from Form.io directly.
 *
 * Until TRANSFORMATIES delivers the neutral form as its own artefact, it comes
 * from Form.io through `fromFormio()`: an Open Formulieren export
 * (forms.json, formSteps.json, formDefinitions.json) or a plain Form.io form
 * (`{ components }`, as GZAC's dossierformulieren are). React-free.
 */

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "radio"
  | "select"
  | "checkboxes"
  | "date"
  | "datetime"
  | "time"
  | "file"
  | "content"
  | "group"
  | "other";

export type Question = {
  key: string;
  label: string;
  type: QuestionType;
  /** The engine's own type, for a hint ("kenteken", "BSN"). */
  engineType: string;
  required: boolean;
  /** Shown only for display (GZAC: filled in by the case, not by the user). */
  readOnly: boolean;
  choices: { value: string; label: string }[];
  /** Show (or hide) when another question has this value. */
  condition?: { key: string; eq: string; show: boolean };
  pattern?: string;
  maxLength?: number;
  /** Nesting in groups (fieldset, panel, columns). */
  depth: number;
  /** JSON pointer into the payload: where the traceregels point. */
  pointer: string;
  /** Text without input (`content`): the HTML is not rendered, only its text. */
  text?: string;
  /** Where it comes from in the model: the GE's Studio id, the field, the name path (neutral `bron`, or a traceregel). */
  bron?: { elementId?: string; veld?: string; pad?: string };
};

export type FormStep = { title: string; slug?: string; questions: Question[] };
export type NeutralForm = { name: string; login: string[]; steps: FormStep[] };

type Obj = Record<string, unknown>;
type Component = Obj & { key?: string; type?: string; label?: string; title?: string; components?: Component[]; columns?: { components?: Component[] }[] };

export const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
export const s = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

export type Field = { pointer: string; depth: number; c: Component };

/** The components of a definition, depth-first, each with its JSON pointer. */
export function fields(components: Component[], base: string, depth = 0): Field[] {
  return components.flatMap((c, n) => {
    const pointer = `${base}/${n}`;
    const own: Field = { pointer, depth, c };
    const children = fields(arr<Component>(c.components), `${pointer}/components`, depth + 1);
    const cols = arr<{ components?: Component[] }>(c.columns).flatMap((col, k) =>
      fields(arr<Component>(col.components), `${pointer}/columns/${k}/components`, depth + 1)
    );
    return [own, ...children, ...cols];
  });
}

/** The step's definition: by the uuid at the end of its form_definition URL, else by position. */
export function definitionOf(step: Obj, defs: Obj[], n: number): number {
  const url = s(step.form_definition);
  const i = defs.findIndex((d) => s(d.uuid) && url.endsWith(s(d.uuid)));
  return i >= 0 ? i : n;
}

const TYPE: Record<string, QuestionType> = {
  textfield: "text",
  email: "text",
  phoneNumber: "text",
  postcode: "text",
  iban: "text",
  licenseplate: "text",
  bsn: "text",
  textarea: "textarea",
  number: "number",
  currency: "number",
  checkbox: "checkbox",
  radio: "radio",
  select: "select",
  selectboxes: "checkboxes",
  date: "date",
  datetime: "datetime",
  time: "time",
  file: "file",
  content: "content",
  fieldset: "group",
  panel: "group",
  container: "group",
  editgrid: "group",
};

/** Layout without a question of its own: its children count, one level up. */
const LAYOUT = new Set(["columns", "well", "table", "tabs"]);

const strip = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function question({ pointer, depth, c }: Field): Question {
  const t = s(c.type);
  const v = obj(c.validate);
  const cond = obj(c.conditional);
  const values = arr<Obj>(c.values ?? obj(c.data).values);
  return {
    key: s(c.key),
    label: s(c.label) || s(c.title),
    type: TYPE[t] ?? "other",
    engineType: t,
    required: Boolean(v.required),
    readOnly: Boolean(c.disabled),
    choices: values.map((x) => ({ value: s(x.value), label: s(x.label) || s(x.value) })).filter((x) => x.value || x.label),
    condition: cond.when ? { key: s(cond.when), eq: s(cond.eq), show: !(cond.show === false || cond.show === "false") } : undefined,
    pattern: v.pattern ? s(v.pattern) : undefined,
    maxLength: typeof v.maxLength === "number" ? v.maxLength : undefined,
    depth,
    pointer,
    text: t === "content" ? strip(s(c.html)) : undefined,
  };
}

/** The questions of a component tree, layout-only containers folded away (their children one level up). */
function questions(components: Component[], base: string): Question[] {
  return fields(components, base)
    .filter((f) => !LAYOUT.has(s(f.c.type)))
    .map((f) => question({ ...f, depth: Math.max(0, f.depth - layoutDepth(f.pointer)) }));
}

/** How many layout containers a pointer passes through (`/columns/<n>/components` once per level). */
const layoutDepth = (pointer: string) => (pointer.match(/\/columns\/\d+\/components/g) ?? []).length;

/**
 * Form.io to a neutral form: an Open Formulieren export (steps in order, each
 * with its definition) or a plain Form.io form (one step; panels as groups).
 */
export function fromFormio(payload: unknown, name = ""): NeutralForm | undefined {
  const p = obj(payload);
  const defs = arr<Obj>(p["formDefinitions.json"]);
  const steps = arr<Obj>(p["formSteps.json"]).sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  if (defs.length || steps.length) {
    const form = obj(arr<Obj>(p["forms.json"])[0]);
    return {
      name: s(form.name) || name,
      login: arr<Obj | string>(form.auth_backends).map((a) => (typeof a === "string" ? a : s(a.backend))).filter(Boolean),
      steps: (steps.length ? steps : defs.map((): Obj => ({}))).map((step, n) => {
        const di = definitionOf(step, defs, n);
        const def = obj(defs[di]);
        return {
          title: s(def.name) || s(step.slug) || `Stap ${n + 1}`,
          slug: s(step.slug) || undefined,
          questions: questions(arr<Component>(obj(def.configuration).components), `/formDefinitions.json/${di}/configuration/components`),
        };
      }),
    };
  }
  if (Array.isArray(p.components)) {
    return { name, login: [], steps: [{ title: name, questions: questions(arr<Component>(p.components), "/components") }] };
  }
  return undefined;
}

/** Whether a question shows, given the answers so far (Form.io's simple conditional). */
export function visible(q: Question, answers: Record<string, unknown>): boolean {
  if (!q.condition) return true;
  const a = answers[q.condition.key];
  const hit = Array.isArray(a) ? a.map(String).includes(q.condition.eq) : String(a ?? "") === q.condition.eq;
  return q.condition.show ? hit : !hit;
}

/**
 * The neutral form as TRANSFORMATIES delivers it (contract `formulier-neutraal`
 * 0.1, 9-11-2026: soort "formulier-neutraal", formaat "omnium-formulier-json"):
 * Dutch keys, one artefact next to each formulier, its traceregels pointing into
 * this payload. Read into the same shape as `fromFormio`, so the werkplaats
 * renders it unchanged. Unknown types ("anders") show as a placeholder.
 */
const NEUTRAAL_TYPE: Record<string, QuestionType> = {
  tekst: "text",
  tekstvak: "textarea",
  email: "text",
  telefoon: "text",
  getal: "number",
  datum: "date",
  datumtijd: "datetime",
  vinkje: "checkbox",
  bestand: "file",
};

export function fromNeutraal(payload: unknown): NeutralForm | undefined {
  const p = obj(payload);
  if (!Array.isArray(p.stappen)) return undefined;
  const formulier = obj(p.formulier);
  return {
    name: s(formulier.naam),
    login: arr<unknown>(formulier.inloggen).map(s).filter(Boolean),
    steps: arr<Obj>(p.stappen).map((st, n) => ({
      title: s(st.titel) || `Stap ${n + 1}`,
      slug: s(st.key) || undefined,
      questions: arr<Obj>(st.vragen).map((v, k): Question => {
        const t = s(v.type);
        const tekst = obj(v.tekst);
        const voorwaarde = obj(v.voorwaarde);
        return {
          key: s(v.key),
          label: s(v.label),
          type: t === "keuze" ? (v.keuzeWeergave === "lijst" ? "select" : "radio") : (NEUTRAAL_TYPE[t] ?? "other"),
          engineType: t === "anders" ? s(v.formio) || "anders" : t,
          required: v.verplicht === true,
          readOnly: false,
          choices: arr<Obj>(v.keuzes).map((c) => ({ value: s(c.waarde), label: s(c.label) || s(c.waarde) })),
          condition: voorwaarde.vraag ? { key: s(voorwaarde.vraag), eq: s(voorwaarde.gelijkAan), show: voorwaarde.toon !== false } : undefined,
          pattern: tekst.patroon ? s(tekst.patroon) : undefined,
          maxLength: typeof tekst.maxLengte === "number" ? tekst.maxLengte : undefined,
          depth: 0,
          pointer: `/stappen/${n}/vragen/${k}`,
          text: v.hulptekst ? s(v.hulptekst) : undefined,
          bron: v.bron ? { elementId: s(obj(v.bron).elementId) || undefined, pad: s(obj(v.bron).pad) || undefined, veld: s(obj(v.bron).pad).split(".").at(-1) || undefined } : undefined,
        };
      }),
    })),
  };
}
