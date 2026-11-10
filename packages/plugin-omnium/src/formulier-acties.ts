import { z } from "zod";
import type { FormStep, NeutralForm, Question, QuestionType } from "./neutral-form";

/**
 * Editing a form in the werkplaats (werkplaats-plan Fase B, laag 1, Mark
 * 10-11-2026): the actions, as typed objects with a schema — the whitelist
 * that later becomes one Studio op per action (laag 2, on the dienst's branch;
 * TRANSFORMATIES' answers in plan §5.11) — and `pasToe`, which applies one to
 * a neutral form. Pure and React-free: the browser edits with it now (nothing
 * is saved), the server will validate with the same schemas later.
 *
 * Addressing is by stable keys, never positions: a step by `stap` (its slug),
 * a question by `vraag` (unique per form), the order by `na` (the question it
 * follows; null = first in the step).
 */

const key = z.string().min(1).max(80);
const na = key.nullable();
const Voorwaarde = z.object({ vraag: key, gelijkAan: z.string(), toon: z.boolean().optional() });
const Bron = z.object({ elementId: key, veld: key, pad: z.string().optional() });

export const FormulierActie = z.discriminatedUnion("actie", [
  z.object({
    actie: z.literal("vraagToevoegen"),
    stap: key,
    na,
    vraag: key,
    label: z.string().max(200),
    type: z.string(),
    bron: Bron,
  }),
  z.object({ actie: z.literal("vraagVerwijderen"), vraag: key }),
  z.object({ actie: z.literal("vraagVerplaatsen"), vraag: key, stap: key, na }),
  z.object({ actie: z.literal("verplichtZetten"), vraag: key, verplicht: z.boolean() }),
  z.object({ actie: z.literal("voorwaardeZetten"), vraag: key, voorwaarde: Voorwaarde.nullable() }),
  z.object({ actie: z.literal("labelWijzigen"), vraag: key, label: z.string().min(1).max(200) }),
  z.object({ actie: z.literal("stapToevoegen"), stap: key, titel: z.string().min(1).max(120), na: key.nullable() }),
  z.object({ actie: z.literal("stapHernoemen"), stap: key, titel: z.string().min(1).max(120) }),
]);
export type FormulierActie = z.infer<typeof FormulierActie>;

/** A field of the model a question can come from (logisch model: profielen.diagram05.elements[id].data.bron.velden). */
export type ModelVeld = {
  elementId: string;
  /** The GE's name (`GpkKaartGegevens`), for the key rule and for showing. */
  ge: string;
  veld: string;
  type: QuestionType;
  /** In words, for the list ("keuze uit GpkSoort", "datum"). */
  soort: string;
  choices: { value: string; label: string }[];
  /** Required in the model: a question from it cannot be left out or made optional (TRANSFORMATIES §5.11). */
  verplicht: boolean;
};

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");
const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/**
 * The provisional form of a model field (§5.11, first match wins): the
 * transformation decides on generation; this is what the preview shows until then.
 */
function vorm(v: Obj): { type: QuestionType; soort: string } {
  if (v.refNaam) return { type: "select", soort: `keuze uit ${str(v.refNaam)}` };
  if (Array.isArray(v.enum) && v.enum.length) return { type: "radio", soort: `keuze${v.enumNaam ? ` uit ${str(v.enumNaam)}` : ""}` };
  const type = str(v.type);
  const format = str(v.format);
  if (type === "boolean") return { type: "checkbox", soort: "vinkje" };
  if (type === "integer" || type === "number") return { type: "number", soort: "getal" };
  if (format === "email") return { type: "text", soort: "e-mail" };
  if (format === "date") return { type: "date", soort: "datum" };
  if (format === "date-time") return { type: "datetime", soort: "datum en tijd" };
  if (format === "phone") return { type: "text", soort: "telefoon" };
  if (str(v.datatypeNaam) === "LangeTekst") return { type: "textarea", soort: "tekstvak" };
  return { type: "text", soort: "tekst" };
}

/** The fields per model element, from the logical model's payload. */
export function modelVelden(logischModel: unknown): Map<string, ModelVeld[]> {
  const elements = o(o(o(o(logischModel).profielen).diagram05).elements);
  const out = new Map<string, ModelVeld[]>();
  for (const [elementId, e] of Object.entries(elements)) {
    const bron = o(o(o(e).data).bron);
    if (!Array.isArray(bron.velden)) continue;
    const ge = str(o(e).naam) || elementId.split("_").at(-1)!;
    out.set(
      elementId,
      (bron.velden as Obj[]).map((v) => ({
        elementId,
        ge,
        veld: str(v.naam),
        ...vorm(v),
        choices: Array.isArray(v.enum) ? (v.enum as unknown[]).map((x) => ({ value: String(x), label: capital(String(x)) })) : [],
        verplicht: v.verplicht === true,
      }))
    );
  }
  return out;
}

const lowerCamel = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

/**
 * The key of a new question (§5.11): the field name; taken, then the GE's name
 * in lowerCamel without the entity prefix, plus the field (EvAanvraagTijdvak.soort
 * → tijdvakSoort); still taken, a digit.
 */
export function nieuweSleutel(form: NeutralForm, veld: string, ge: string, entiteit = ""): string {
  const taken = new Set(form.steps.flatMap((st) => st.questions.map((q) => q.key)));
  if (!taken.has(veld)) return veld;
  const zonder = entiteit && ge.startsWith(entiteit) && ge.length > entiteit.length ? ge.slice(entiteit.length) : ge;
  const base = `${lowerCamel(zonder)}${capital(veld)}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

/** Where a question is: its step and index. */
const vind = (form: NeutralForm, vraag: string) => {
  for (let s = 0; s < form.steps.length; s++) {
    const i = form.steps[s]!.questions.findIndex((q) => q.key === vraag);
    if (i >= 0) return { s, i };
  }
  return undefined;
};

/** Insert after `na` in a step (null = first; an unknown `na` = last). */
function voegIn(step: FormStep, q: Question, na: string | null): FormStep {
  const qs = step.questions.filter((x) => x.key !== q.key);
  const at = na === null ? 0 : qs.findIndex((x) => x.key === na) + 1 || qs.length;
  return { ...step, questions: [...qs.slice(0, at), q, ...qs.slice(at)] };
}

export class ActieFout extends Error {}

/**
 * Apply one action to a form; a new form, the old one untouched. Throws
 * `ActieFout` when the action does not fit (an unknown key, a model-required
 * field made optional or removed).
 */
export function pasToe(form: NeutralForm, actie: FormulierActie, velden?: Map<string, ModelVeld[]>): NeutralForm {
  const a = FormulierActie.parse(actie);
  const stapIndex = (k: string) => {
    const i = form.steps.findIndex((st) => st.slug === k);
    if (i < 0) throw new ActieFout(`Onbekende stap “${k}”.`);
    return i;
  };
  const vraagAt = (k: string) => {
    const at = vind(form, k);
    if (!at) throw new ActieFout(`Onbekende vraag “${k}”.`);
    return at;
  };
  const steps = [...form.steps];
  const modelVerplicht = (q: Question) =>
    Boolean(q.bron?.elementId && velden?.get(q.bron.elementId)?.find((v) => v.veld === q.bron?.veld)?.verplicht);
  const zet = (k: string, f: (q: Question) => Question) => {
    const { s, i } = vraagAt(k);
    const qs = [...steps[s]!.questions];
    qs[i] = f(qs[i]!);
    steps[s] = { ...steps[s]!, questions: qs };
    return { ...form, steps };
  };

  switch (a.actie) {
    case "vraagToevoegen": {
      if (vind(form, a.vraag)) throw new ActieFout(`Er is al een vraag “${a.vraag}”.`);
      const s = stapIndex(a.stap);
      const mv = velden?.get(a.bron.elementId)?.find((v) => v.veld === a.bron.veld);
      const q: Question = {
        key: a.vraag,
        label: a.label,
        type: (a.type as QuestionType) || mv?.type || "text",
        engineType: mv?.soort ?? a.type,
        required: Boolean(mv?.verplicht),
        readOnly: false,
        choices: mv?.choices ?? [],
        depth: 0,
        pointer: `/nieuw/${a.vraag}`,
        bron: { elementId: a.bron.elementId, veld: a.bron.veld, pad: a.bron.pad },
      };
      steps[s] = voegIn(steps[s]!, q, a.na);
      return { ...form, steps };
    }
    case "vraagVerwijderen": {
      const { s, i } = vraagAt(a.vraag);
      const q = steps[s]!.questions[i]!;
      if (modelVerplicht(q)) throw new ActieFout(`“${q.label || q.key}” is verplicht in het model: weglaten kan alleen met een vaste waarde.`);
      steps[s] = { ...steps[s]!, questions: steps[s]!.questions.filter((x) => x.key !== a.vraag) };
      // A condition on the removed question no longer has anything to look at.
      return { ...form, steps: steps.map((st) => ({ ...st, questions: st.questions.map((x) => (x.condition?.key === a.vraag ? { ...x, condition: undefined } : x)) })) };
    }
    case "vraagVerplaatsen": {
      const { s, i } = vraagAt(a.vraag);
      const q = steps[s]!.questions[i]!;
      const t = stapIndex(a.stap);
      steps[s] = { ...steps[s]!, questions: steps[s]!.questions.filter((x) => x.key !== a.vraag) };
      steps[t] = voegIn(steps[t]!, q, a.na);
      return { ...form, steps };
    }
    case "verplichtZetten":
      return zet(a.vraag, (q) => {
        if (!a.verplicht && modelVerplicht(q)) throw new ActieFout(`“${q.label || q.key}” is verplicht in het model; dat kan de dienst niet opheffen.`);
        return { ...q, required: a.verplicht };
      });
    case "voorwaardeZetten":
      if (a.voorwaarde && !vind(form, a.voorwaarde.vraag)) throw new ActieFout(`Onbekende vraag “${a.voorwaarde.vraag}” in de voorwaarde.`);
      if (a.voorwaarde?.vraag === a.vraag) throw new ActieFout("Een vraag kan niet van zichzelf afhangen.");
      return zet(a.vraag, (q) => ({
        ...q,
        condition: a.voorwaarde ? { key: a.voorwaarde.vraag, eq: a.voorwaarde.gelijkAan, show: a.voorwaarde.toon !== false } : undefined,
      }));
    case "labelWijzigen":
      return zet(a.vraag, (q) => ({ ...q, label: a.label }));
    case "stapToevoegen": {
      if (form.steps.some((st) => st.slug === a.stap)) throw new ActieFout(`Er is al een stap “${a.stap}”.`);
      const at = a.na === null ? 0 : stapIndex(a.na) + 1;
      steps.splice(at, 0, { title: a.titel, slug: a.stap, questions: [] });
      return { ...form, steps };
    }
    case "stapHernoemen": {
      const i = stapIndex(a.stap);
      steps[i] = { ...steps[i]!, title: a.titel };
      return { ...form, steps };
    }
  }
}

/** An action in words, for the list of changes not yet generated. */
export function beschrijf(a: FormulierActie): string {
  switch (a.actie) {
    case "vraagToevoegen":
      return `Vraag “${a.label}” toegevoegd aan stap ${a.stap} (uit ${a.bron.pad ?? `${a.bron.elementId}.${a.bron.veld}`})`;
    case "vraagVerwijderen":
      return `Vraag ${a.vraag} weggelaten`;
    case "vraagVerplaatsen":
      return `Vraag ${a.vraag} verplaatst naar stap ${a.stap}${a.na ? `, na ${a.na}` : ", als eerste"}`;
    case "verplichtZetten":
      return `Vraag ${a.vraag} ${a.verplicht ? "verplicht" : "optioneel"}`;
    case "voorwaardeZetten":
      return a.voorwaarde
        ? `Vraag ${a.vraag} ${a.voorwaarde.toon === false ? "verdwijnt" : "verschijnt alleen"} als ${a.voorwaarde.vraag} = ${a.voorwaarde.gelijkAan}`
        : `Vraag ${a.vraag} zonder voorwaarde`;
    case "labelWijzigen":
      return `Vraag ${a.vraag} heet nu “${a.label}”`;
    case "stapToevoegen":
      return `Stap “${a.titel}” toegevoegd`;
    case "stapHernoemen":
      return `Stap ${a.stap} heet nu “${a.titel}”`;
  }
}
