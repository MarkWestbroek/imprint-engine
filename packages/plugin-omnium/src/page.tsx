import Link from "next/link";
import type { ReactNode } from "react";
import { DefaultView, type WidgetContext, type WidgetViewers } from "@imprint/runtime-admin";
import { registerProblem } from "./client";
import { inrichtingFor, type OmniumSubject } from "./context";
import { AmbiguousKey, INRICHTING_TYPES, type Pad } from "./inrichting";
import { OmniumDetail, OmniumFormulier, OmniumLijst, OmniumTekening } from "./widgets";

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
}: {
  path: string[];
  viewers: WidgetViewers;
  ctx: WidgetContext;
  prefix?: string;
  peiltijdstip?: string;
  geldigOp?: string;
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

  const subject: OmniumSubject = { ...located, omnium: true, prefix, at: { peiltijdstip, geldigOp } };
  const header = (
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
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">{INRICHTING_TYPES[located.pad].label}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{located.title}</h1>
      {peiltijdstip && <p className="mt-1 text-sm text-muted">Zoals het register het op {peiltijdstip} vastlegde.</p>}
    </header>
  );
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

/** Without a template: the record, and what hangs under it. */
async function BuiltIn({ subject, ctx }: { subject: OmniumSubject; ctx: WidgetContext }) {
  const i = inrichtingFor(subject.prefix, subject.at.peiltijdstip, subject.at.geldigOp)!;
  const richting = subject.pad === "artefacten" ? await i.richting(subject.record) : undefined;
  type Lijst = { title: string; pad?: Pad; koppeling?: string; veld?: string; richting?: "gegenereerd" | "bron"; leeg?: string };
  const lists: Partial<Record<Pad, Lijst[]>> = {
    ediensten: [{ title: "Versies", pad: "edienstversies", koppeling: "edienstversie_ediensten" }],
    edienstversies: [
      { title: "Resultaten", pad: "artefacten", koppeling: "artefact_edienstversies", richting: "gegenereerd" },
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
      {live && (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm">
          Live:{" "}
          <a href={live} className="font-medium text-accent underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
            {live}
          </a>
        </p>
      )}
      {subject.pad === "artefacten" && <OmniumFormulier config={{ title: "Formulier" }} subject={subject} ctx={ctx} />}
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
