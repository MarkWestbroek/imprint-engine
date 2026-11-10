import Link from "next/link";
import type { ReactNode } from "react";
import { DefaultView, type WidgetContext, type WidgetViewers } from "@imprint/runtime-admin";
import { registerProblem } from "./client";
import { inrichtingFor, type OmniumSubject } from "./context";
import { AmbiguousKey, INRICHTING_TYPES, type Located, type Pad } from "./inrichting";
import { OmniumBeslistabel, OmniumDetail, OmniumFormulier, OmniumLijst, OmniumTekening } from "./widgets";
import { EERSTE_STAP, isStap } from "./werkplaats";
import { WerkplaatsView } from "./werkplaats-view";
import type { FormulierActie } from "./formulier-acties";
import type { OpslaanResultaat } from "./werkplaats-opslaan";

/**
 * A register record as a page: `/inrichting/<key path>` → the record, rendered
 * with the studio template `_view/omnium-<pad>` (DefaultView, the record as
 * subject), or the built-in view below when there is none. The route file
 * lives in the site, because the site composes the viewers:
 *
 *   const page = await omniumPage({ path, viewers: widgetComponents, ctx: await widgetContext() });
 *   if (!page) notFound();
 *   return page.render;
 */

export type OmniumPage = { title: string; render: ReactNode };

/** "_view/omnium-ediensten": the template a type's pages render with. */
export const omniumViewType = (pad: Pad) => `omnium-${pad}`;

export async function omniumPage({
  path,
  viewers,
  ctx,
  prefix = "/inrichting",
  peiltijdstip,
  geldigOp,
  element,
  veld,
  vraag,
  bewerk,
  werkplaatsOpslaan,
}: {
  path: string[];
  viewers: WidgetViewers;
  ctx: WidgetContext;
  prefix?: string;
  peiltijdstip?: string;
  geldigOp?: string;
  /** A drawing: the element to highlight (`data-element-id`). */
  element?: string;
  /** With `element`: one field of it (the text with `data-dc-veld`), lit up too. */
  veld?: string;
  /** In the werkplaats, step 3: the selected question (its key). */
  vraag?: string;
  /** In the werkplaats, step 3: edit mode. */
  bewerk?: boolean;
  /**
   * The site's server action that saves the werkplaats form (a one-line "use
   * server" wrapper around `slaOpVoorPad`, checking the role); omit for readers.
   */
  werkplaatsOpslaan?: (pad: string[], acties: FormulierActie[]) => Promise<OpslaanResultaat>;
}): Promise<OmniumPage | null> {
  const i = inrichtingFor(prefix, peiltijdstip, geldigOp);
  if (!i) return problem("Deze site heeft geen register ingesteld (OMNIUM_REGISTER_URL).");
  let located;
  try {
    located = await i.locate(path);
  } catch (err) {
    if (err instanceof AmbiguousKey) {
      return problem(`Meer dan één record (${err.count}) hoort bij dit adres; de sleutel is in het register niet uniek.`);
    }
    return problem(registerProblem(err));
  }
  if (!located) return null;

  const subject: OmniumSubject = { ...located, omnium: true, prefix, at: { peiltijdstip, geldigOp }, element, veld };
  if (located.werkplaats !== undefined) {
    const stap = located.werkplaats || EERSTE_STAP;
    if (!isStap(stap)) return null;
    return {
      title: `Werkplaats ${located.title}`,
      render: (
        <article>
          <Header located={located} prefix={prefix} label="Werkplaats" peiltijdstip={peiltijdstip} />
          <WerkplaatsView
            subject={subject}
            stap={stap}
            vraag={vraag}
            bewerk={bewerk}
            // Bound to this version's key path, so the browser cannot aim it elsewhere.
            opslaan={werkplaatsOpslaan?.bind(null, path.slice(0, 4))}
            ctx={ctx}
          />
        </article>
      ),
    };
  }
  const header = <Header located={located} prefix={prefix} label={INRICHTING_TYPES[located.pad].label} peiltijdstip={peiltijdstip} />;
  return {
    title: located.title,
    render: (
      <article>
        {header}
        <DefaultView
          type={omniumViewType(located.pad)}
          subject={subject}
          title=""
          viewers={viewers}
          ctx={ctx}
          fallback={<BuiltIn subject={subject} ctx={ctx} />}
        />
      </article>
    ),
  };
}

function Header({ located, prefix, label, peiltijdstip }: { located: Located; prefix: string; label: string; peiltijdstip?: string }) {
  return (
    <header className="mb-6">
      <nav className="text-sm text-muted" aria-label="Kruimelpad">
        <Link href={prefix} className="hover:underline">Inrichting</Link>
        {located.crumbs.map((c) => (
          <span key={c.href}>
            {" › "}
            <Link href={c.href} className="hover:underline">{c.label}</Link>
          </span>
        ))}
      </nav>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">{label}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{located.title}</h1>
      {peiltijdstip && <p className="mt-1 text-sm text-muted">Zoals het register het op {peiltijdstip} vastlegde.</p>}
    </header>
  );
}

/** Without a template: the record, and what hangs under it. */
async function BuiltIn({ subject, ctx }: { subject: OmniumSubject; ctx: WidgetContext }) {
  const i = inrichtingFor(subject.prefix, subject.at.peiltijdstip, subject.at.geldigOp)!;
  const richting = subject.pad === "artefacten" ? await i.richting(subject.record) : undefined;
  type Lijst = { title: string; pad?: Pad; koppeling?: string; veld?: string; richting?: "gegenereerd" | "bron"; groepeer?: "component"; leeg?: string };
  const lists: Partial<Record<Pad, Lijst[]>> = {
    componenten: [{ title: "Versies", pad: "component_versies", koppeling: "componentversie_componenten", leeg: "Nog geen versies in het register." }],
    ediensten: [{ title: "Versies", pad: "edienstversies", koppeling: "edienstversie_ediensten" }],
    edienstversies: [
      { title: "Resultaten", pad: "artefacten", koppeling: "artefact_edienstversies", richting: "gegenereerd", groepeer: "component" },
      { title: "Bronnen", pad: "artefacten", koppeling: "artefact_edienstversies", richting: "bron", leeg: "Nog geen bronnen in het register." },
      { title: "Uitrollen", pad: "uitrollen", koppeling: "uitrol_edienstversies" },
    ],
    // Only a result has traceregels; a source or a drawing shows its drawing instead.
    artefacten: richting === "gegenereerd" ? [{ title: "Traceregels", veld: "artefact_traceregels" }] : [],
    uitrollen: [{ title: "Resultaten", veld: "uitrol_resultaten" }],
  };
  const live = subject.pad === "artefacten" ? await i.liveUrl(subject.record).catch(() => undefined) : undefined;
  return (
    <div className="space-y-8">
      {subject.pad === "edienstversies" && (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm">
          <Link href={`${subject.href}/werkplaats`} className="font-medium text-accent underline-offset-2 hover:underline">
            Open de werkplaats →
          </Link>{" "}
          <span className="text-muted">model, stappen en effect van deze versie naast elkaar</span>
        </p>
      )}
      {live && (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm">
          Live:{" "}
          <a href={live} className="font-medium text-accent underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
            {live}
          </a>
        </p>
      )}
      {subject.pad === "artefacten" && <OmniumFormulier config={{ title: "Formulier" }} subject={subject} ctx={ctx} />}
      {subject.pad === "artefacten" && <OmniumBeslistabel config={{ title: "Beslistabel" }} subject={subject} ctx={ctx} />}
      {richting && richting !== "gegenereerd" && <OmniumTekening config={{ title: "Tekening" }} subject={subject} ctx={ctx} />}
      <OmniumDetail
        config={{
          title: "Gegevens",
          // A drawing's payload is the SVG above; a source's payload (Studio JSON) stays, folded.
          verberg: richting === "weergave" ? "uitrol_resultaten,artefact_traceregels,artefact_inhouden" : "uitrol_resultaten,artefact_traceregels",
        }}
        subject={subject}
        ctx={ctx}
      />
      {(lists[subject.pad] ?? []).map((l) => (
        <OmniumLijst key={l.title} config={l} subject={subject} ctx={ctx} />
      ))}
    </div>
  );
}

function problem(message: string): OmniumPage {
  return {
    title: "Register niet beschikbaar",
    render: (
      <div role="alert" className="rounded-xl border border-line bg-surface p-5 text-sm">
        {message}
      </div>
    ),
  };
}
