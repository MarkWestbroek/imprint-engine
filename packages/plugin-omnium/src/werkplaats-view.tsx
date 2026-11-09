import Link from "next/link";
import type { ReactNode } from "react";
import type { WidgetContext } from "@imprint/runtime-admin";
import { sanitizeSvg } from "@imprint/widgets-standard/svg-sanitize";
import type { OmniumSubject } from "./context";
import { inrichtingOf } from "./context";
import { DiagramDialog, DiagramLink, type Drawing } from "./diagram-dialog";
import { FormPreview } from "./form-preview";
import { fromFormio, type NeutralForm, type Question } from "./neutral-form";
import { currentHubs, ge, geRows } from "./register";
import { Tabs } from "./tabs";
import { OmniumBeslistabel, OmniumLijst } from "./widgets";
import {
  modelStappen,
  STAPPEN,
  veldSleutel,
  werkplaatsData,
  type Artefact,
  type Stap,
  type Tekening,
  type Trace,
  type WerkplaatsData,
} from "./werkplaats";

/**
 * The werkplaats of an e-dienstversie (werkplaats-plan §3, Fase A): a
 * stappenbalk and three panes — the model of this service (the uitsnede), the
 * step, and its effect. Read-only: nothing here writes; that is Fase B.
 *
 * Route: `/inrichting/ediensten/<code>/versies/<nr>/werkplaats/<stap>`; the
 * selected question of step 3 is `?vraag=<key>`, so a choice can be shared.
 */

const TYPE_WORD: Record<string, string> = {
  textfield: "tekstveld",
  textarea: "tekstvak",
  number: "getal",
  checkbox: "vinkje",
  radio: "keuzerondjes",
  select: "keuzelijst",
  selectboxes: "meerkeuze",
  date: "datum",
  file: "bestand",
  email: "e-mail",
  licenseplate: "kenteken",
  bsn: "BSN",
};

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted">{children}</span>;

function Pane({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 p-4 lg:[&+&]:border-l [&+&]:border-t lg:[&+&]:border-t-0 border-line">
      <h2 className="flex items-baseline justify-between gap-2 font-semibold">
        {title}
        {sub && <small className="text-xs font-normal text-muted">{sub}</small>}
      </h2>
      {children}
    </section>
  );
}

/** Where a model field sits in the window's drawings: the smallest drawing that has the element. */
type Waar = (t: Trace | undefined) => { d: number; id: string; veld?: string } | undefined;

export async function WerkplaatsView({ subject, stap, vraag, ctx }: { subject: OmniumSubject; stap: Stap; vraag?: string; ctx: WidgetContext }) {
  const i = inrichtingOf(subject)!;
  const data = await werkplaatsData(i, subject.record);
  const base = subject.href.replace(/\/werkplaats(\/.*)?$/, "/werkplaats");
  const versieHref = subject.href.replace(/\/werkplaats(\/.*)?$/, "");

  // The window's drawings: the logical model (smallest first), then processes and decisions.
  const tekeningen: Tekening[] = [...data.modelTekeningen, ...data.procesTekeningen];
  const drawings: Drawing[] = tekeningen.map((t) => ({ title: t.title, href: t.href ?? "#", svg: sanitizeSvg(t.svg) ?? "" }));
  const waar: Waar = (t) => {
    if (!t?.bronElementId) return undefined;
    const d = tekeningen.findIndex((x) => x.ids.has(t.bronElementId!));
    if (d < 0) return undefined;
    const parts = t.bronGE?.split(".") ?? [];
    return { d, id: t.bronElementId, veld: parts.length >= 3 ? parts.at(-1) : undefined };
  };

  // Step 3: per question its trace (by the form's JSON pointer), and the row the window jumps back to.
  const questions = data.form?.steps.flatMap((st) => st.questions) ?? [];
  const traceOf = (key: string) => {
    const q = questions.find((x) => x.key === key);
    return q ? data.formTraces.get(q.pointer) : undefined;
  };
  const rows: Record<string, string> = {};
  for (const q of questions) {
    const w = waar(data.formTraces.get(q.pointer));
    if (w?.veld) rows[`${w.id}|${w.veld}`] ??= `wp-vraag-${q.key}`;
  }

  const n = STAPPEN.findIndex((st) => st.slug === stap);
  const titel = STAPPEN[n]!.titel;
  const live = data.formulier ? await i.liveUrl(data.formulier.record).catch(() => undefined) : undefined;

  const middle = await midden({ stap, data, base, vraag, waar, traceOf, ctx, subject, versieHref });
  const right = await effect({ stap, data, vraag, traceOf, live, i, subject });

  return (
    <DiagramDialog drawings={drawings} rows={rows}>
      <div className="space-y-4">
        <Stappenbalk data={data} base={base} stap={stap} />
        {stap === "voorbeeld" ? (
          <div className="grid gap-6 rounded-xl border border-line bg-surface p-4 lg:grid-cols-2">{right}</div>
        ) : (
          <div className="grid rounded-xl border border-line bg-surface lg:grid-cols-[1fr_1.25fr_1fr]">
            <Pane title="Model van deze dienst" sub={data.keuzes.size ? `${data.telling.gekozen} velden gekozen · ${data.telling.weggelaten} weggelaten` : "uitsnede"}>
              <Uitsnede data={data} tekeningen={tekeningen} />
            </Pane>
            <Pane title={titel}>{middle}</Pane>
            <Pane title="Effect" sub="uit het register">
              {right}
            </Pane>
          </div>
        )}
        <nav className="flex justify-between text-sm" aria-label="Vorige en volgende stap">
          {n > 0 ? (
            <Link href={`${base}/${STAPPEN[n - 1]!.slug}`} className="hover:underline">
              ← {STAPPEN[n - 1]!.titel}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">Alles wat je kiest, wordt een traceregel: van modelveld naar artefact.</span>
          {n < STAPPEN.length - 1 ? (
            <Link href={`${base}/${STAPPEN[n + 1]!.slug}`} className="hover:underline">
              {STAPPEN[n + 1]!.titel} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </DiagramDialog>
  );
}

function Stappenbalk({ data, base, stap }: { data: WerkplaatsData; base: string; stap: Stap }) {
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Stappen">
      {STAPPEN.map((st, n) => {
        const stand = data.stand[st.slug];
        const nu = st.slug === stap;
        const cls = nu
          ? "border-foreground bg-foreground text-background"
          : stand === "klaar"
            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
            : stand === "nog-niet"
              ? "border-dashed border-line text-muted"
              : "border-line text-muted";
        return (
          <li key={st.slug} className="shrink-0">
            <Link
              href={`${base}/${st.slug}`}
              aria-current={nu ? "step" : undefined}
              title={stand === "klaar" ? "In het register aanwezig" : stand === "nog-niet" ? "Kan nog niet: er is nog geen catalogus (Fase B)" : "Nog niet in het register"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:underline ${cls}`}
            >
              <span className="font-mono text-xs">{n + 1}</span>
              {st.titel}
              {stand === "klaar" && !nu && <span aria-label="klaar">✓</span>}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** The model elements this service uses, grouped by entity, with the fields; each opens the window. */
function Uitsnede({ data, tekeningen }: { data: WerkplaatsData; tekeningen: Tekening[] }) {
  // The elements: those the results read, and those the e-dienstmodel chose or left out (as far as a drawing has them).
  const inModel = (id: string) => tekeningen.some((t) => t.ids.has(id));
  const ids = [...new Set([...data.uitsnede.keys(), ...[...data.keuzes.keys()].filter(inModel)])];
  if (!ids.length) return <p className="text-sm text-muted">Geen traceregels met een modelelement (bronElementId) in het register.</p>;
  // A gegevenselement `Entiteit_GE` under its entity; an entity or relation is a heading itself; generated
  // ids (`el_…`, `enum_…`, `dt_…`) under "Overig", by the name the drawing gives them.
  type Item = { id: string; naam: string; velden: string[]; weg: string[]; d: number; type: string; uit: boolean };
  const groups = new Map<string, { d: number; id?: string; type?: string; uit?: boolean; velden?: string[]; weg?: string[]; items: Item[] }>();
  const group = (naam: string) => {
    if (!groups.has(naam)) groups.set(naam, { d: -1, items: [] });
    return groups.get(naam)!;
  };
  for (const id of ids) {
    const velden = data.uitsnede.get(id) ?? new Set<string>();
    const k = data.keuzes.get(id);
    // Left out entirely: nothing chosen and nothing reads it.
    const uit = !data.uitsnede.has(id) && Boolean(k?.weggelaten.size);
    const d = tekeningen.findIndex((t) => t.ids.has(id));
    const type = tekeningen[d]?.ids.get(id) ?? "";
    const label = tekeningen[d]?.labels.get(id);
    const generated = /^(el|enum|dt|ref)_/.test(id);
    const [entiteit, ...rest] = id.split("_");
    const naam = generated ? (label ?? id) : rest.join("_") || id;
    // A path over a relation can end in the element's own name; that is not a field of it.
    const own = new Set([naam, entiteit].map((x) => x?.toLowerCase()));
    const veld = (v: string) => Boolean(v) && !own.has(v.toLowerCase());
    const weg = [...(k?.weggelaten ?? [])].filter((v) => veld(v) && !velden.has(v)).sort();
    if (!generated && rest.length === 0) {
      // An entity or relation can carry fields of its own (AanvraagPartij.partijrol).
      Object.assign(group(id), { d, id, type, uit, weg, velden: [...velden].filter(veld).sort() });
      continue;
    }
    group(generated ? "Overig" : entiteit!).items.push({ id, naam, velden: [...velden].filter(veld).sort(), weg, d, type, uit });
  }
  const perTekening = data.modelTekeningen
    .map((t, d) => ({ t, d, set: [...data.uitsnede.keys()].filter((id) => t.ids.has(id)) }))
    .filter((x) => x.set.length)
    .sort((a, b) => b.set.length - a.set.length);
  return (
    <div className="space-y-3 text-sm">
      {[...groups].map(([naam, g]) => (
        <div key={naam} className="rounded-lg border border-line bg-white p-2.5">
          <p className={`font-medium ${g.uit && !g.items.some((x) => !x.uit) ? "text-muted line-through" : ""}`}>
            {g.id && g.d >= 0 ? (
              <DiagramLink href={tekeningen[g.d]?.href ?? "#"} d={g.d} id={g.id}>
                {naam}
              </DiagramLink>
            ) : (
              naam
            )}
            {g.type && g.type !== "entiteit" && <Muted> · {g.type}</Muted>}
          </p>
          {g.velden && g.velden.length > 0 && <span className="block text-xs text-muted">{g.velden.join(" · ")}</span>}
          {g.weg && g.weg.length > 0 && <Weg velden={g.weg} />}
          {g.items.length > 0 && (
            <ul className="mt-1 space-y-1">
              {g.items.map((x) => (
                <li key={x.id} className={x.uit ? "text-muted" : ""}>
                  <DiagramLink href={tekeningen[x.d]?.href ?? "#"} d={x.d} id={x.id}>
                    {x.uit ? <span className="line-through">{x.naam}</span> : x.naam}
                  </DiagramLink>
                  {x.type && x.type !== "gegevenselement" && <Muted> · {x.type}</Muted>}
                  {x.uit && <Muted> · weggelaten</Muted>}
                  {x.velden.length > 0 && <span className="block text-xs text-muted">{x.velden.join(" · ")}</span>}
                  {!x.uit && x.weg.length > 0 && <Weg velden={x.weg} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {perTekening.map(({ t, d, set }) => (
          <DiagramLink key={d} href={t.href ?? "#"} d={d} id={set[0]!} set={set} className="rounded border border-line px-2 py-1 text-xs hover:bg-white">
            Toon in diagram: {t.title}
          </DiagramLink>
        ))}
      </div>
      <p className="text-xs text-muted">
        {data.keuzes.size
          ? "Doorgestreept: wel in het model, door deze dienst weggelaten (uit het e-dienstmodel)."
          : "Velden die het model wel heeft maar deze dienst niet gebruikt, komen hier zodra het e-dienstmodel ze per gegevenselement noemt."}
      </p>
    </div>
  );
}

const Weg = ({ velden }: { velden: string[] }) => (
  <span className="block text-xs text-muted">
    <span className="sr-only">weggelaten: </span>
    {velden.map((v, n) => (
      <span key={v}>
        {n > 0 && " · "}
        <s>{v}</s>
      </span>
    ))}
  </span>
);

const shortGE = (bronGE?: string) => bronGE?.split(".").slice(-2).join(".");

function toonAls(t?: Record<string, unknown>) {
  if (!t) return "";
  return Object.entries(t)
    .map(([k, v]) => `${k} = ${v === true ? "ja" : v === false ? "nee" : String(v)}`)
    .join(" en ");
}

type MiddenArgs = {
  stap: Stap;
  data: WerkplaatsData;
  base: string;
  vraag?: string;
  waar: Waar;
  traceOf: (key: string) => Trace | undefined;
  ctx: WidgetContext;
  subject: OmniumSubject;
  versieHref: string;
};

async function midden({ stap, data, base, vraag, waar, traceOf, ctx, subject, versieHref }: MiddenArgs): Promise<ReactNode> {
  switch (stap) {
    case "basis":
    case "specialiseren": {
      const formulier = (data.edienstmodel?.artefacten as Record<string, unknown>[] | undefined)?.find((a) => a.soort === "formulier");
      return (
        <div className="space-y-3 text-sm">
          <p>
            {stap === "basis"
              ? "Hier kies je straks een generieke basis uit de catalogus: Aanvraag, Melding, Vergunning — of je leidt af van een bestaande dienst."
              : "Hier geef je straks de dienst een naam en kies je welke patronen erbij horen: medisch advies, een product dat wordt uitgegeven, een besluit."}
          </p>
          <p className="rounded-lg border border-dashed border-line p-3 text-muted">
            Deze stap kan nog niet: er is nog geen catalogus van bases en patronen. Dat komt in Fase B van het werkplaatsplan.
          </p>
          {typeof formulier?.bron === "string" && (
            <p>
              Deze dienst gaat nu uit van <strong>{formulier.bron}</strong>, zoals het e-dienstmodel het vastlegt.
            </p>
          )}
        </div>
      );
    }
    case "velden":
      return <Velden data={data} base={base} vraag={vraag} waar={waar} traceOf={traceOf} />;
    case "proces":
      return <Proces data={data} ctx={ctx} subject={subject} />;
    case "genereren":
      return <Genereren data={data} />;
    case "uitrollen":
      return (
        <OmniumLijst config={{ title: "", pad: "uitrollen", koppeling: "uitrol_edienstversies", leeg: "Deze versie is nog niet uitgerold." }} subject={{ ...subject, werkplaats: undefined }} ctx={ctx} />
      );
    case "voorbeeld":
      return null;
  }
  void versieHref;
}

function Velden({ data, base, vraag, waar, traceOf }: { data: WerkplaatsData; base: string; vraag?: string; waar: Waar; traceOf: (key: string) => Trace | undefined }) {
  const { stappen, registratie } = modelStappen(data.edienstmodel);
  const q = new Map<string, Question>((data.form?.steps.flatMap((st) => st.questions) ?? []).map((x) => [x.key, x]));
  // From the e-dienstmodel when it has the steps (what Fase B will edit), else from the generated form.
  const list =
    stappen.length > 0
      ? stappen
      : (data.form?.steps ?? []).map((st) => ({
          naam: st.title,
          velden: st.questions.filter((x) => x.type !== "group" && x.type !== "content").map((x) => ({ veld: traceOf(x.key)?.bronGE ?? "", key: x.key, label: x.label, verplicht: x.required, toonAls: x.condition ? { [x.condition.key]: x.condition.eq } : undefined, component: undefined })),
        }));
  const aantal = list.reduce((n, st) => n + st.velden.length, 0);
  const vast = Object.entries((registratie.vasteWaarden as Record<string, unknown>) ?? {});
  const inlog = Object.entries((registratie.uitInlog as Record<string, unknown>) ?? {});
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted">
        {aantal} vragen in {list.length} stappen{stappen.length ? ", zoals het e-dienstmodel ze kiest" : ", uit het gegenereerde formulier"}. Kies een vraag om te zien wat hij raakt.
      </p>
      {list.map((st, k) => (
        <section key={k}>
          <h3 className="mb-1 font-medium">
            {k + 1}. {st.naam}
          </h3>
          <ul className="divide-y divide-line/60 rounded-lg border border-line bg-white">
            {st.velden.map((v) => {
              const t = traceOf(v.key);
              const w = waar(t);
              const sel = v.key === vraag;
              const soort = v.component ?? q.get(v.key)?.engineType;
              return (
                <li key={v.key} id={`wp-vraag-${v.key}`} tabIndex={-1} className={`scroll-mt-24 p-2 outline-none ${sel ? "bg-yellow-50" : ""}`}>
                  <Link href={`${base}/velden?vraag=${encodeURIComponent(v.key)}`} scroll={false} className="font-medium hover:underline" aria-current={sel ? "true" : undefined}>
                    {v.label || v.key}
                  </Link>
                  <span className="ml-2 text-xs">{v.verplicht ? "verplicht" : <Muted>optioneel</Muted>}</span>
                  <span className="block text-xs text-muted">
                    <code>{v.key}</code>
                    {soort && ` · ${TYPE_WORD[soort] ?? soort}`}
                    {v.toonAls && ` · alleen als ${toonAls(v.toonAls)}`}
                  </span>
                  {(t?.bronGE || v.veld) && (
                    <span className="block text-xs">
                      uit{" "}
                      {w ? (
                        <DiagramLink href="#" {...w}>
                          <code>{shortGE(t?.bronGE ?? v.veld)}</code>
                        </DiagramLink>
                      ) : (
                        <code>{shortGE(t?.bronGE ?? v.veld)}</code>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {(vast.length > 0 || inlog.length > 0) && (
        <section>
          <h3 className="mb-1 font-medium">Zonder vraag</h3>
          <ul className="space-y-0.5 text-xs">
            {vast.map(([k, v]) => (
              <li key={k}>
                <code>{shortGE(k)}</code> = <code>{String(v)}</code> <Muted>(vaste waarde)</Muted>
              </li>
            ))}
            {inlog.map(([k, v]) => (
              <li key={k}>
                <code>{shortGE(k)}</code> ← {String(v)} <Muted>(uit de inlog)</Muted>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Proces({ data, ctx, subject }: { data: WerkplaatsData; ctx: WidgetContext; subject: OmniumSubject }) {
  const bpmn = data.resultaten.filter((a) => a.soort === "bpmn");
  const dmn = data.resultaten.filter((a) => a.soort === "dmn");
  const offset = data.modelTekeningen.length;
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="mb-1 font-medium">Processen</h3>
        <ul className="space-y-1">
          {bpmn.map((a) => (
            <li key={a.record.id}>
              <ArtefactLink a={a} />
            </li>
          ))}
        </ul>
        {data.procesTekeningen.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.procesTekeningen.map((t, k) => (
              <DiagramLink key={k} href={t.href ?? "#"} d={offset + k} id={[...t.ids.keys()][0] ?? ""} className="rounded border border-line px-2 py-1 text-xs hover:bg-white">
                Tekening: {t.title}
              </DiagramLink>
            ))}
          </div>
        )}
      </section>
      {dmn.map((a) => (
        <OmniumBeslistabel key={a.record.id} config={{ title: `Regels: ${a.title}` }} subject={{ ...subject, pad: "artefacten", record: a.record, title: a.title, werkplaats: undefined }} ctx={ctx} />
      ))}
    </div>
  );
}

/** The current and the previous version of an artefact's content (`artefact_inhouden`), by opvoer. */
function generaties(a: Artefact): { nu?: Record<string, unknown>; vorige?: Record<string, unknown> } {
  const versions = currentHubs(a.record, "artefact_inhouden")
    .flatMap((h) => (Array.isArray(h.data) ? h.data : []))
    .filter((v) => v && typeof v === "object" && (v as { opvoer?: string }).opvoer)
    .sort((x, y) => String((y as { opvoer?: string }).opvoer).localeCompare(String((x as { opvoer?: string }).opvoer))) as Record<string, unknown>[];
  return { nu: versions[0], vorige: versions[1] };
}

function Genereren({ data }: { data: WerkplaatsData }) {
  const byComponent = new Map<string, Artefact[]>();
  for (const a of data.resultaten) byComponent.set(a.component ?? "—", [...(byComponent.get(a.component ?? "—") ?? []), a]);
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted">
        {data.resultaten.length} artefacten gegenereerd. Genereren gaat nu nog met de hand (TRANSFORMATIES); als dienst komt het in Fase C.
      </p>
      {[...byComponent].map(([c, list]) => (
        <section key={c}>
          <h3 className="mb-1 font-medium">{c}</h3>
          <ul className="divide-y divide-line/60 rounded-lg border border-line bg-white">
            {list.map((a) => {
              const { nu } = generaties(a);
              const herkomst = ge(a.record, "artefact_herkomsten");
              return (
                <li key={a.record.id} className="p-2">
                  <ArtefactLink a={a} />
                  <span className="block text-xs text-muted">
                    {a.soort}
                    {herkomst?.regelsetId ? ` · ${String(herkomst.regelsetId)}@${String(herkomst.regelsetVersie ?? "")}` : ""}
                    {nu?.opvoer ? ` · ${String(nu.opvoer).slice(0, 16).replace("T", " ")}` : ""}
                    {` · ${geRows(a.record, "artefact_traceregels").length} traceregels`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ArtefactLink({ a }: { a: Artefact }) {
  return a.href ? (
    <Link href={a.href} className="hover:underline">
      {a.title}
    </Link>
  ) : (
    <span>{a.title}</span>
  );
}

/** What the right pane shows, per step. */
async function effect({
  stap,
  data,
  vraag,
  traceOf,
  live,
  i,
  subject,
}: {
  stap: Stap;
  data: WerkplaatsData;
  vraag?: string;
  traceOf: (key: string) => Trace | undefined;
  live?: string;
  i: NonNullable<ReturnType<typeof inrichtingOf>>;
  subject: OmniumSubject;
}): Promise<ReactNode> {
  const dossier = (re: RegExp) =>
    data.resultaten
      .filter((a) => a.soort === "dossierformulier" && re.test(String(ge(a.record, "artefact_identificaties")?.identifier ?? "")))
      .map((a) => ({ a, form: fromFormio(parseJson(ge(a.record, "artefact_inhouden")?.payload), a.title) }))
      .filter((x): x is { a: Artefact; form: NeutralForm } => Boolean(x.form));
  const dossierTab = (list: { a: Artefact; form: NeutralForm }[], leeg: string) =>
    list.length ? (
      <div className="space-y-4">
        {list.map(({ a, form }) => (
          <div key={a.record.id}>
            <p className="mb-1 text-xs text-muted">
              Scherm in GZAC: <ArtefactLink a={a} />
            </p>
            <FormPreview form={form} highlight={vraag} compact />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted">{leeg}</p>
    );
  const formulier = data.form ? (
    <div className="space-y-2">
      <FormPreview form={data.form} highlight={vraag} />
      <p className="text-xs text-muted">
        Een eigen weergave van het gegenereerde formulier (niet ingebed: zo blijft het voorbeeld los van Open Formulieren).
        {live && (
          <>
            {" "}
            <a href={live} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              Open in Open Formulieren ↗
            </a>
          </>
        )}
      </p>
    </div>
  ) : (
    <p className="text-sm text-muted">Nog geen formulier gegenereerd.</p>
  );
  const tabs = [
    { label: "Formulier", content: formulier },
    { label: "Beoordelen", content: dossierTab(dossier(/beoordel|summary/), "Geen beoordelingsscherm gegenereerd.") },
    { label: "Beschikking", content: dossierTab(dossier(/beschikking|afwijzing/), "Geen beschikkingsscherm gegenereerd.") },
  ];

  switch (stap) {
    case "voorbeeld":
      return (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Als inwoner</h2>
            {formulier}
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Als behandelaar</h2>
            <Tabs label="Schermen van de behandelaar" tabs={tabs.slice(1)} />
          </section>
        </>
      );
    case "velden":
    case "basis":
    case "specialiseren":
      return (
        <div className="space-y-4">
          <Tabs label="Effect" tabs={tabs} />
          <Raakt data={data} vraag={vraag} traceOf={traceOf} />
        </div>
      );
    case "proces": {
      const koppelingen = data.resultaten.filter((a) => a.soort === "proceskoppeling");
      return (
        <div className="space-y-3 text-sm">
          <h3 className="font-medium">Welke taak welk scherm toont</h3>
          {koppelingen.length ? (
            koppelingen.map((a) => (
              <div key={a.record.id}>
                <ArtefactLink a={a} />
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {geRows(a.record, "artefact_traceregels").map((t, k) => (
                    <li key={k}>
                      {String(t.regel ?? "")} <code>{String(t.bronGE ?? "")}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-muted">Geen taakkoppelingen gegenereerd.</p>
          )}
        </div>
      );
    }
    case "genereren": {
      const gewijzigd = data.resultaten.filter((a) => {
        const { nu, vorige } = generaties(a);
        return vorige && nu?.payloadHash !== vorige.payloadHash;
      });
      const metVorige = data.resultaten.filter((a) => generaties(a).vorige);
      return (
        <div className="space-y-2 text-sm">
          <h3 className="font-medium">Verschil met de vorige generatie</h3>
          {metVorige.length === 0 ? (
            <p className="text-muted">
              Het register heeft van deze artefacten nog geen vorige inhoud. Een aanwijsbare generatie (werkplaatsplan §5.6) maakt dit verschil per generatie.
            </p>
          ) : (
            <>
              <p>
                {gewijzigd.length} van {metVorige.length} artefacten veranderd.
              </p>
              <ul className="space-y-0.5">
                {gewijzigd.map((a) => (
                  <li key={a.record.id}>
                    <ArtefactLink a={a} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      );
    }
    case "uitrollen": {
      const components = new Map<string, Awaited<ReturnType<typeof i.draaitVan>>>();
      for (const c of await i.list("componenten")) {
        const naam = i.componentNaam(c);
        if (naam && data.resultaten.some((a) => a.component === naam)) components.set(await i.title("componenten", c), await i.draaitVan(c));
      }
      return (
        <div className="space-y-2 text-sm">
          <h3 className="font-medium">Wat er draait</h3>
          <ul className="space-y-1">
            {[...components].map(([naam, draait]) => (
              <li key={naam}>
                {naam}: {draait.length ? draait.map((d) => `${d.versie ?? "?"} (${d.omgeving})`).join(", ") : <Muted>niet in het register</Muted>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Uitrollen gaat nu nog met de hand (FUNDAMENT); als dienst komt het in Fase C.</p>
        </div>
      );
    }
  }
  void subject;
}

/** "Deze keuze raakt": the results whose traceregels come from the chosen question's model field (or from any field of the form). */
function Raakt({ data, vraag, traceOf }: { data: WerkplaatsData; vraag?: string; traceOf: (key: string) => Trace | undefined }) {
  const t = vraag ? traceOf(vraag) : undefined;
  const keys = t
    ? [veldSleutel(t)].filter((k): k is string => Boolean(k))
    : [...data.formTraces.values()].map(veldSleutel).filter((k): k is string => Boolean(k) && !k!.startsWith("ge:"));
  const hits = new Map<Artefact, Set<string>>();
  for (const k of new Set(keys)) for (const { artefact, traces } of data.raakt.get(k) ?? []) {
    const set = hits.get(artefact) ?? new Set<string>();
    traces.forEach((x) => set.add(x.regel ?? ""));
    hits.set(artefact, set);
  }
  const list = [...hits].sort((a, b) => (a[0].component ?? "").localeCompare(b[0].component ?? ""));
  return (
    <section className="rounded-lg border border-line bg-white p-3 text-sm">
      <h3 className="font-medium">
        {t ? (
          <>
            Deze keuze raakt <Muted>({shortGE(t.bronGE)})</Muted>
          </>
        ) : (
          "De vragen van dit formulier raken"
        )}
      </h3>
      {list.length ? (
        <ul className="mt-1 space-y-1">
          {list.map(([a, regels]) => (
            <li key={a.record.id}>
              <ArtefactLink a={a} /> <Muted>· {a.soort}{a.component ? ` · ${a.component}` : ""}</Muted>
              <span className="block text-xs text-muted">
                {[...regels].filter(Boolean).slice(0, 2).join(" · ")}
                {regels.size > 2 && ` · en ${regels.size - 2} meer`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted">Geen traceregels met dit modelveld.</p>
      )}
      <p className="mt-2 text-xs text-muted">
        {list.length} artefacten in {new Set(list.map(([a]) => a.component)).size} componenten.
      </p>
    </section>
  );
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
