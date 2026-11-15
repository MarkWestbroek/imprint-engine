import Link from "next/link";
import type { WritableContentStore } from "@imprint/content-core";
import { Markdown, type PluginCall, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import type { Stemmen } from "./audio";
import { grammaticaId, leesbaar, listGrammatica } from "./grammatica";
import { GRAMMATICA, grammaticaHref, lesHref, lesSlug, pakketHref, pakketNaam, pakketTaal } from "./href";
import { kentVormen, teksten, UI_TALEN } from "./i18n";
import { Leerling } from "./leerling";
import { Lesdialoog, LesOefeningen } from "./les-view";
import { listLessen, oefeningenVoor, perFase, tekstVoor } from "./lessen";
import { GrammaticaOverzicht, GrammaticaView, MeerGrammatica } from "./naslag";
import type { Grammatica, Les } from "./schemas";
import { vormen } from "./tekst";
import { VormKeuze, Vormen } from "./vorm";
import { LesScore } from "./voortgang";

/**
 * The public pages of the language training:
 *
 *   /<ui>                    → the default package
 *   /<ui>/<pakket>           the lessons of a package, per phase
 *   /<ui>/<pakket>/<les>     one lesson: dialogue, chunks, rebuild, exercises
 *   /<ui>/<pakket>/grammatica           the grammar reference of the package
 *   /<ui>/<pakket>/grammatica/<topic>   one topic (naslag.tsx)
 *
 * `<ui>` is the interface language, `<pakket>` the language taught (href.ts).
 * All public and without a session, so the site prerenders them; who is
 * looking is asked in the browser (leerling.tsx).
 */
export type TaalRouteOptions = {
  /** The interface languages this site offers; default: all the plugin has texts for. */
  ui?: string[];
  /** The package `/<ui>` opens (the language taught); default nl. */
  pakket?: string;
  stemmen?: Stemmen;
};

function Overzicht({ ui, taal, lessen, metGrammatica, call }: { ui: string; taal: string; lessen: Les[]; metGrammatica: boolean; call?: PluginCall }) {
  const t = teksten(ui);
  return (
    <div lang={ui} className="max-w-3xl">
      <Leerling call={call} />
      <p className="eyebrow">{t.lessen}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t.pakket[taal] ?? taal}</h1>
      {metGrammatica && (
        <p className="mt-2">
          <Link href={grammaticaHref(ui, taal)} className="font-semibold text-accent hover:underline">
            {t.grammatica.naam} →
          </Link>
        </p>
      )}
      {kentVormen(ui) && (
        <div className="mt-4">
          <VormKeuze labels={t.vorm} />
        </div>
      )}
      {lessen.length === 0 && <p className="mt-6 text-muted">{t.geenLessen}</p>}
      {perFase(lessen).map(({ fase, lessen: vanFase }) => (
        <section key={fase} className="mt-8">
          <h2 className="eyebrow mb-3">
            {t.fase} {fase}
          </h2>
          <ol className="space-y-2">
            {vanFase.map((les) => (
              <li key={les.id}>
                <Link
                  href={lesHref(ui, les)}
                  className="flex items-center justify-between gap-4 rounded-md border border-line bg-background px-5 py-4 hover:border-accent"
                >
                  <span>
                    <span className="mr-3 text-muted">{lessen.indexOf(les) + 1}</span>
                    <span className="text-lg font-semibold" lang={les.taal}>
                      {les.titel}
                    </span>
                  </span>
                  <LesScore id={les.id} label={t.score} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LesView({ ui, les, vorige, volgende, topics, stemmen, call }: { ui: string; les: Les; vorige?: Les; volgende?: Les; topics: Grammatica[]; stemmen?: Stemmen; call?: PluginCall }) {
  const t = teksten(ui);
  const situatie = tekstVoor(les.situatie, ui);
  const patroon = tekstVoor(les.patroon, ui);
  return (
    <article lang={ui} className="max-w-3xl">
      <Leerling call={call} />
      <Link href={pakketHref(ui, les.taal)} className="text-sm text-muted hover:underline">
        ← {t.alleLessen}
      </Link>
      <p className="eyebrow mt-4">
        {t.pakket[les.taal] ?? les.taal} · {t.fase} {les.fase}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight" lang={les.taal}>
        {les.titel}
      </h1>

      {situatie && (
        <p className="mt-3 text-lg text-muted">
          <Vormen>{situatie}</Vormen>
        </p>
      )}
      {kentVormen(ui) && (
        <div className="mt-4">
          <VormKeuze labels={t.vorm} />
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">{t.dialoog}</h2>
        <Lesdialoog les={les} ui={ui} stemmen={stemmen} />
      </section>

      {patroon && (
        <section className="mt-8 rounded-md border border-line bg-surface p-5">
          <h2 className="eyebrow mb-2">
            <Vormen>{t.zagJeDat}</Vormen>
          </h2>
          <div className="markdown">
            {/* Markdown renders on the server, which knows no choice: both forms. */}
            <Markdown>{vormen(patroon)}</Markdown>
          </div>
          <MeerGrammatica ui={ui} les={les} topics={topics} />
        </section>
      )}
      {!patroon && <MeerGrammatica ui={ui} les={les} topics={topics} />}

      {les.ombouwen && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{t.ombouwen}</h2>
          <div className="markdown" lang={les.taal}>
            <Markdown>{les.ombouwen.replace(/^\*\*Ombouwen:\*\*\s*/, "")}</Markdown>
          </div>
        </section>
      )}

      {oefeningenVoor(les, ui).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{t.oefeningen}</h2>
          <LesOefeningen les={les} ui={ui} stemmen={stemmen} />
        </section>
      )}

      <nav className="mt-10 flex justify-between gap-4 border-t border-line pt-6 text-sm">
        <span>
          {vorige && (
            <Link href={lesHref(ui, vorige)} className="hover:underline">
              ← {t.vorige}
            </Link>
          )}
        </span>
        <span>
          {volgende && (
            <Link href={lesHref(ui, volgende)} className="font-semibold text-accent hover:underline">
              {t.volgendeLes} →
            </Link>
          )}
        </span>
      </nav>
    </article>
  );
}

const uiTalen = (opts: TaalRouteOptions) => (opts.ui ?? UI_TALEN).filter((ui) => UI_TALEN.includes(ui));

export function taalPublicRoute(opts: TaalRouteOptions = {}) {
  const standaard = opts.pakket ?? "nl";
  return async ({ imprint, slug, call }: PublicRouteContext): Promise<PublicRouteResult | null> => {
    const store = imprint.writableStore;
    const [ui, pakket, naam] = slug;
    if (!store || !ui || slug.length > 4 || !uiTalen(opts).includes(ui)) return null;
    if (!pakket) return { redirect: pakketHref(ui, standaard) };
    const taal = pakketTaal(pakket);
    if (!taal) return null;
    const lessen = (await listLessen(store)).filter((l) => l.taal === taal);
    // The topics a reader in this interface language can read.
    const topics = (await listGrammatica(store)).filter((g) => g.taal === taal && leesbaar(g, ui));
    const t = teksten(ui);

    if (!naam) {
      // A package without lessons is a page only when it is the one the site opens with.
      if (lessen.length === 0 && taal !== standaard) return null;
      return {
        render: <Overzicht ui={ui} taal={taal} lessen={lessen} metGrammatica={topics.length > 0} call={call} />,
        metadata: { title: `${t.pakket[taal] ?? taal}: ${t.lessen.toLowerCase()}` },
      };
    }
    if (naam === GRAMMATICA) {
      if (topics.length === 0) return null;
      const onderwerpSlug = slug[3];
      if (!onderwerpSlug) {
        return { render: <GrammaticaOverzicht ui={ui} taal={taal} topics={topics} />, metadata: { title: `${t.pakket[taal] ?? taal}: ${t.grammatica.naam.toLowerCase()}` } };
      }
      const onderwerp = topics.find((g) => g.id === grammaticaId(taal, onderwerpSlug));
      if (!onderwerp) return null;
      return {
        render: <GrammaticaView ui={ui} onderwerp={onderwerp} lessen={lessen} />,
        metadata: { title: tekstVoor(onderwerp.titel, ui), description: tekstVoor(onderwerp.kort, ui) || undefined },
        item: { type: "grammatica", slug: onderwerp.id },
      };
    }
    if (slug.length > 3) return null;
    const i = lessen.findIndex((l) => lesSlug(l) === naam);
    const les = lessen[i];
    if (!les) return null;
    return {
      render: <LesView ui={ui} les={les} vorige={lessen[i - 1]} volgende={lessen[i + 1]} topics={topics} stemmen={opts.stemmen} call={call} />,
      metadata: { title: les.titel, description: les.dialoog.map((r) => r[les.taal]).filter(Boolean).slice(0, 2).join(" ") },
      item: { type: "les", slug: les.id },
    };
  };
}

/** Every address the route answers, for the site's `generateStaticParams`. */
export async function taalStaticPaths(store: WritableContentStore | null, opts: TaalRouteOptions = {}): Promise<string[][]> {
  if (!store) return [];
  const lessen = await listLessen(store);
  const grammatica = await listGrammatica(store);
  const talen = new Set([opts.pakket ?? "nl", ...lessen.map((l) => l.taal)]);
  return uiTalen(opts).flatMap((ui) => {
    const leesbare = grammatica.filter((g) => leesbaar(g, ui));
    const metGrammatica = [...new Set(leesbare.map((g) => g.taal))];
    return [
      ...[...talen].map((taal) => [ui, pakketNaam(taal)]),
      ...lessen.map((les) => [ui, pakketNaam(les.taal), lesSlug(les)]),
      ...metGrammatica.map((taal) => [ui, pakketNaam(taal), GRAMMATICA]),
      ...leesbare.map((g) => [ui, pakketNaam(g.taal), GRAMMATICA, g.slug]),
    ];
  });
}
