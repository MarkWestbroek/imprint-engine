import type { ReactNode } from "react";
import { ResizableTable } from "./resizable-table";

/**
 * An Open Formulieren form (the export the transformation writes: forms.json,
 * formSteps.json, formDefinitions.json with Form.io components, formLogic.json,
 * formVariables.json) as a read-only overview for whoever sets it up: per step
 * the fields, and for every field where it comes from in the model and where it
 * goes in the objecttype. Not a rendering of the form as a resident sees it —
 * that is the live link. Server-side; no Form.io code.
 *
 * The traceregels point into the payload with a JSON pointer (`doelPad`):
 * `/formDefinitions.json/0/configuration/components/1` is a field,
 * `/forms.json/0/registration_backends/0/options/variables_mapping/7` its
 * mapping to the objecttype, `/formVariables.json/2` a fixed value.
 */

type Obj = Record<string, unknown>;
type Component = Obj & { key?: string; type?: string; label?: string; components?: Component[]; columns?: { components?: Component[] }[] };
export type Trace = { bronGE?: string; regel?: string };

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const s = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

/** Form.io types in words. */
const TYPES: Record<string, string> = {
  textfield: "tekstveld",
  textarea: "tekstvak",
  number: "getal",
  checkbox: "vinkje",
  radio: "keuzerondjes",
  select: "keuzelijst",
  selectboxes: "meerkeuze",
  date: "datum",
  datetime: "datum en tijd",
  time: "tijd",
  email: "e-mail",
  phoneNumber: "telefoonnummer",
  postcode: "postcode",
  iban: "IBAN",
  licenseplate: "kenteken",
  bsn: "BSN",
  file: "bestand",
  currency: "bedrag",
  content: "tekst (geen invoer)",
  fieldset: "groep",
  columns: "kolommen",
  editgrid: "herhaalgroep",
  map: "kaart",
  signature: "handtekening",
  addressNL: "adres",
};

type Field = { pointer: string; depth: number; c: Component };

/** The components of a definition, depth-first, each with its JSON pointer. */
function fields(components: Component[], base: string, depth = 0): Field[] {
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

function condition(c: Component): string {
  const cond = obj(c.conditional);
  if (!cond.when) return "";
  const show = cond.show === false || cond.show === "false" ? "verborgen" : "alleen";
  return `${show} als ${s(cond.when)} = ${s(cond.eq)}`;
}

function rules(c: Component): string {
  const v = obj(c.validate);
  const out: string[] = [];
  if (v.pattern) out.push(`patroon ${s(v.pattern)}`);
  if (v.maxLength) out.push(`max. ${s(v.maxLength)} tekens`);
  if (v.min !== undefined && v.min !== "") out.push(`min. ${s(v.min)}`);
  if (v.max !== undefined && v.max !== "") out.push(`max. ${s(v.max)}`);
  return out.join(", ");
}

const choices = (c: Component) =>
  arr<Obj>(c.values ?? obj(c.data).values)
    .map((v) => s(v.label) || s(v.value))
    .filter(Boolean)
    .join(", ");

/** The step's definition: by the uuid at the end of its form_definition URL, else by position. */
function definitionOf(step: Obj, defs: Obj[], n: number): number {
  const url = s(step.form_definition);
  const i = defs.findIndex((d) => s(d.uuid) && url.endsWith(s(d.uuid)));
  return i >= 0 ? i : n;
}

const Th = ({ children }: { children: ReactNode }) => <th className="py-2 pr-4 font-medium">{children}</th>;
const Td = ({ children }: { children: ReactNode }) => <td className="py-2 pr-4 align-top">{children}</td>;
const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted">{children}</span>;

function Source({ t }: { t?: Trace }) {
  if (!t?.bronGE) return <Muted>—</Muted>;
  return (
    <span title={t.regel}>
      <code className="break-all text-[0.9em]">{t.bronGE}</code>
    </span>
  );
}

export function OpenFormulier({ payload, traces }: { payload: unknown; traces: Map<string, Trace> }) {
  const p = obj(payload);
  const form = obj(arr<Obj>(p["forms.json"])[0]);
  const steps = arr<Obj>(p["formSteps.json"]).sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  const defs = arr<Obj>(p["formDefinitions.json"]);
  const logic = arr<Obj>(p["formLogic.json"]);
  const variables = arr<Obj>(p["formVariables.json"]);
  const backend = obj(arr<Obj>(form.registration_backends)[0]);
  const options = obj(backend.options);
  const mapping = arr<Obj>(options.variables_mapping);
  if (!defs.length && !steps.length) return <p className="text-sm text-muted">Geen Open Formulieren-export (geen stappen of definities).</p>;

  // A field key → where the registration puts it in the objecttype, with the trace of that mapping.
  const target = new Map<string, { path: string; t?: Trace }>();
  mapping.forEach((m, n) =>
    target.set(s(m.variable_key), {
      path: arr<unknown>(m.target_path).map(s).join("."),
      t: traces.get(`/forms.json/0/registration_backends/0/options/variables_mapping/${n}`),
    })
  );
  const fieldKeys = new Set<string>();

  return (
    <div className="space-y-8 text-sm">
      <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-1">
        <dt className="text-muted">Naam</dt>
        <dd>{s(form.name) || "—"}</dd>
        <dt className="text-muted">Slug</dt>
        <dd>
          <code>{s(form.slug) || "—"}</code>
        </dd>
        <dt className="text-muted">Inloggen</dt>
        <dd>
          {form.login_required ? "verplicht" : "niet verplicht"}
          {arr<unknown>(form.auth_backends).length > 0 &&
            ` (${arr<Obj>(form.auth_backends)
              .map((a) => s(a.backend) || s(a))
              .join(", ")})`}
        </dd>
        <dt className="text-muted">Registratie</dt>
        <dd>
          {s(backend.name) || s(backend.backend) || "—"}
          {options.objecttype ? (
            <>
              {" "}
              → objecttype <code className="break-all text-[0.9em]">{s(options.objecttype)}</code>
            </>
          ) : null}
        </dd>
        {obj(p["_meta.json"]).of_release ? (
          <>
            <dt className="text-muted">Open Formulieren</dt>
            <dd>{s(obj(p["_meta.json"]).of_release)}</dd>
          </>
        ) : null}
      </dl>

      {steps.map((step, n) => {
        const di = definitionOf(step, defs, n);
        const def = obj(defs[di]);
        const list = fields(arr<Component>(obj(def.configuration).components), `/formDefinitions.json/${di}/configuration/components`);
        list.forEach((f) => f.c.key && fieldKeys.add(f.c.key));
        return (
          <section key={n}>
            <h3 className="mb-2 font-semibold">
              Stap {n + 1}: {s(def.name) || s(step.slug)}
            </h3>
            <div className="overflow-x-auto">
              <ResizableTable className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <Th>Vraag</Th>
                    <Th>Sleutel</Th>
                    <Th>Soort</Th>
                    <Th>Verplicht</Th>
                    <Th>Keuzes en regels</Th>
                    <Th>Uit het model</Th>
                    <Th>Naar het objecttype</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ pointer, depth, c }) => {
                    const to = c.key ? target.get(c.key) : undefined;
                    const extra = [choices(c), condition(c), rules(c)].filter(Boolean).join(" · ");
                    return (
                      <tr key={pointer} className="border-b border-line/60">
                        <Td>
                          <span style={{ paddingLeft: `${depth * 1.25}rem` }}>{s(c.label) || <Muted>(zonder label)</Muted>}</span>
                        </Td>
                        <Td>
                          <code className="break-all text-[0.9em]">{s(c.key)}</code>
                        </Td>
                        <Td>{TYPES[s(c.type)] ?? s(c.type)}</Td>
                        <Td>{obj(c.validate).required ? "ja" : <Muted>nee</Muted>}</Td>
                        <Td>{extra || <Muted>—</Muted>}</Td>
                        <Td>
                          <Source t={traces.get(pointer)} />
                        </Td>
                        <Td>{to ? <code className="break-all text-[0.9em]">{to.path}</code> : <Muted>—</Muted>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </ResizableTable>
            </div>
          </section>
        );
      })}

      {mapping.some((m) => !fieldKeys.has(s(m.variable_key))) && (
        <section>
          <h3 className="mb-2 font-semibold">Ook naar het objecttype</h3>
          <p className="mb-2 text-muted">Waarden die niet uit een vraag komen: vaste waarden, de inlog, het afronden.</p>
          <div className="overflow-x-auto">
            <ResizableTable className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <Th>Variabele</Th>
                  <Th>Waarde</Th>
                  <Th>Uit het model</Th>
                  <Th>Naar het objecttype</Th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((m, n) => {
                  const key = s(m.variable_key);
                  if (fieldKeys.has(key)) return null;
                  const vi = variables.findIndex((v) => s(v.key) === key);
                  const v = obj(variables[vi]);
                  const t = traces.get(`/forms.json/0/registration_backends/0/options/variables_mapping/${n}`) ?? traces.get(`/formVariables.json/${vi}`);
                  const value = v.initial_value !== undefined && v.initial_value !== null && v.initial_value !== "" ? JSON.stringify(v.initial_value) : "";
                  return (
                    <tr key={key + n} className="border-b border-line/60">
                      <Td>
                        <code className="break-all text-[0.9em]">{key}</code>
                      </Td>
                      <Td>{value ? <code className="break-all text-[0.9em]">{value}</code> : <Muted>{t?.regel ?? "—"}</Muted>}</Td>
                      <Td>
                        <Source t={t} />
                      </Td>
                      <Td>
                        <code className="break-all text-[0.9em]">{arr<unknown>(m.target_path).map(s).join(".")}</code>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </ResizableTable>
          </div>
        </section>
      )}

      {logic.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Logica</h3>
          <ul className="space-y-2">
            {logic.map((rule, n) => (
              <li key={n}>
                <p>{s(rule.description) || <Muted>(zonder omschrijving)</Muted>}</p>
                <p className="text-xs text-muted">
                  als <code>{JSON.stringify(rule.json_logic_trigger)}</code>
                  {arr<Obj>(rule.actions).map((a, k) => (
                    <span key={k}>
                      {" "}
                      → {s(obj(a.action).type)} {s(a.variable) || s(a.component)}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
