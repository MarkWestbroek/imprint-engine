import Link from "next/link";
import type { Inrichting } from "./inrichting";
import { ge } from "./register";
import { ALLE, inrichtingstool, namespaces, scan, type Onderdeel } from "./omgeving-scan";
import {
  bestaandeKoppelingen,
  kaartenPerLaag,
  modelBoom,
  modelVersies,
  opnameGegevens,
  transformatieOverzicht,
  vastgelegdAlsKoppeling,
  WIZARD_STAPPEN,
  type WizardStap,
} from "./omgeving-wizard";
import { DoelVinkje, KoppelingenScherm, OpnemenKaart } from "./omgeving-wizard-client";
import { voorstelVoor, type Opname } from "./component-opname";
import { componentIds, edienstversieKeuzes, vastgelegdeKoppelingen, type KoppelingHandeling } from "./koppeling-register";
import type { KoppelingResultaat } from "./koppeling-opslaan";

type Opslaan = (h: KoppelingHandeling) => Promise<KoppelingResultaat>;
type ComponentOpslaan = (o: Opname) => Promise<KoppelingResultaat>;

/** The omgevingswizard's pages (server). `ns` = the chosen namespaces, carried in the URL from step to step. */
export async function OmgevingWizardView({
  i,
  stap,
  ns,
  prefix,
  opslaan,
  componentOpslaan,
}: {
  i: Inrichting;
  stap: WizardStap;
  ns: string[];
  prefix: string;
  opslaan?: Opslaan;
  componentOpslaan?: ComponentOpslaan;
}) {
  const basis = `${prefix}/omgevingswizard`;
  const q = ns.length ? `?${ns.map((n) => `ns=${encodeURIComponent(n)}`).join("&")}` : "";
  const nr = WIZARD_STAPPEN.findIndex((s) => s.id === stap);
  const volgende = WIZARD_STAPPEN[nr + 1];
  const vorige = WIZARD_STAPPEN[nr - 1];
  return (
    <div className="space-y-6">
      <nav aria-label="Stappen" className="flex flex-wrap gap-2 text-sm">
        {WIZARD_STAPPEN.map((s, k) => (
          <Link
            key={s.id}
            href={`${basis}/${s.id}${q}`}
            aria-current={s.id === stap ? "step" : undefined}
            className={`rounded-full border px-3 py-1 ${s.id === stap ? "border-accent bg-accent/10 font-medium" : "border-line text-muted hover:text-current"}`}
          >
            {k + 1}. {s.titel}
          </Link>
        ))}
      </nav>
      <p role="note" className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
        {opslaan
          ? "De wizard schrijft alleen koppelingen naar het register (stap 5); de rest is bekijken. Het cluster raakt hij niet aan."
          : "Alleen bekijken: de wizard schrijft niets naar het register of het cluster."}{" "}
        Installeren zelf gebeurt buiten deze site, via de plugin; stap 1 laat zien wat zij vond en koos.
      </p>
      {stap === "installatie" && <StapInstallatie />}
      {stap === "omgeving" && <StapOmgeving i={i} ns={ns} actie={`${basis}/componenten`} />}
      {stap !== "omgeving" && stap !== "installatie" && !ns.length && (
        <p className="text-sm">
          Nog geen omgeving gekozen. <Link href={`${basis}/omgeving`} className="text-accent hover:underline">Kies er eerst een →</Link>
        </p>
      )}
      {stap === "componenten" && ns.length > 0 && <StapComponenten i={i} ns={ns} opslaan={componentOpslaan} />}
      {stap === "model" && ns.length > 0 && <StapModel i={i} />}
      {stap === "koppelingen" && ns.length > 0 && <StapKoppelingen i={i} ns={ns} opslaan={opslaan} />}
      {stap === "transformaties" && ns.length > 0 && <StapTransformaties i={i} ns={ns} />}
      {stap === "installatie" && (
        <div className="flex justify-end text-sm">
          <Link href={`${basis}/omgeving${q}`} className="text-accent hover:underline">Omgeving kiezen →</Link>
        </div>
      )}
      {stap !== "omgeving" && stap !== "installatie" && (
        <div className="flex justify-between text-sm">
          {vorige ? <Link href={`${basis}/${vorige.id}${q}`} className="text-accent hover:underline">← {vorige.titel}</Link> : <span />}
          {volgende && ns.length > 0 && <Link href={`${basis}/${volgende.id}${q}`} className="text-accent hover:underline">{volgende.titel} →</Link>}
        </div>
      )}
    </div>
  );
}

async function StapOmgeving({ i, ns, actie }: { i: Inrichting; ns: string[]; actie: string }) {
  const { namen, voorbeeld, opgenomen, fout } = await namespaces(i);
  return (
    <form action={actie} method="get" className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Welke omgeving wil je inrichten?</h2>
      <p className="text-sm text-muted">
        Kies een of meer namespaces: een omgeving kan over meer dan één namespace verspreid zijn. De scan kijkt wat er draait (workloads, labels,
        routes) en herkent de componenten uit het register.
      </p>
      {voorbeeld && <Voorbeeld opgenomen={opgenomen} />}
      {fout && <p role="alert" className="text-sm">{fout}</p>}
      <fieldset className="space-y-2">
        <legend className="sr-only">Namespaces</legend>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="ns" value={ALLE} defaultChecked={ns.includes(ALLE)} /> Alle namespaces
        </label>
        {namen.map((n) => (
          <label key={n.naam} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ns" value={n.naam} defaultChecked={ns.includes(n.naam)} />
            <code>{n.naam}</code>
            {(n.fundamentNaam || n.project) && <span className="text-muted">{[n.fundamentNaam, n.project].filter(Boolean).join(" · ")}</span>}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong">Scannen →</button>
    </form>
  );
}

function Voorbeeld({ opgenomen }: { opgenomen?: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm">
      <strong>Voorbeeld.</strong> Dit is niet de live scan van de plugin.{" "}
      {opgenomen
        ? `Wat je ziet is een echte scan van het cluster, opgenomen op ${new Date(opgenomen).toLocaleString("nl-NL")}; niet van nu.`
        : "Wat je ziet is afgeleid uit wat het register over de omgevingen weet, aangevuld met een onderdeel dat de scan niet zou herkennen."}
    </p>
  );
}

async function StapComponenten({ i, ns, opslaan }: { i: Inrichting; ns: string[]; opslaan?: ComponentOpslaan }) {
  const s = await scan(i, ns);
  const [lagen, gegevens] = await Promise.all([kaartenPerLaag(i, s), opnameGegevens(i)]);
  const aantal = lagen.reduce((n, l) => n + l.kaarten.length, 0);
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Omgeving in beeld</h2>
        <p className="text-sm text-muted">
          {s.namespaces.includes(ALLE) ? "Alle namespaces" : s.namespaces.join(", ")} · {aantal} gevonden · gescand{" "}
          {new Date(s.gescandOp).toLocaleString("nl-NL")}
          {s.herkenningUit && <> · herkend volgens {s.herkenningUit === "register" ? "het register" : "de ingebouwde tabel van de plugin"}</>}
        </p>
      </header>
      {s.voorbeeld && <Voorbeeld opgenomen={s.opgenomen} />}
      {s.fout && <p role="alert" className="text-sm">{s.fout}</p>}
      {s.meldingen?.map((m) => (
        <p key={m} className="text-sm text-muted">{m}</p>
      ))}
      {!aantal && !s.fout && <p className="text-sm text-muted">Niets gevonden in deze namespaces.</p>}
      {lagen.map((l) => (
        <div key={l.laag}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{l.laag}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {l.kaarten.map((k) => {
              const verschil = k.registerVersie && k.scan.versie && k.registerVersie !== k.scan.versie;
              return (
                <li key={`${k.scan.namespace}/${k.scan.naam}`} className={`rounded-xl border p-4 ${k.component ? "border-line bg-surface" : "border-dashed border-line"}`}>
                  <p className="font-medium">
                    {k.component?.href ? <Link href={k.component.href} className="hover:underline">{k.component.weergavenaam}</Link> : k.component?.weergavenaam ?? k.scan.naam}
                  </p>
                  <p className="text-xs text-muted">
                    <code>{k.scan.namespace}</code> · {k.scan.bron}
                    {k.scan.viaHelm ? " via Helm" : ""}
                    {k.scan.chart ? ` · chart ${k.scan.chart}${k.scan.chartVersie ? ` ${k.scan.chartVersie}` : ""}` : ""}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-sm">
                    <dt className="text-muted">versie</dt>
                    <dd>
                      {k.scan.versie ?? "onbekend"}
                      {verschil && <span className="ml-1 rounded bg-accent/15 px-1 text-xs">register: {k.registerVersie}</span>}
                    </dd>
                    <dt className="text-muted">adres</dt>
                    <dd className="truncate">{k.scan.adres ? <code className="text-xs">{k.scan.adres}</code> : k.scan.adresIntern ? <code className="text-xs">{k.scan.adresIntern}</code> : "—"}</dd>
                    <dt className="text-muted">bereikbaar</dt>
                    <dd>{k.scan.bereikbaar === null ? "niet getest" : k.scan.bereikbaar ? "ja" : "nee"}</dd>
                    {k.scan.onderdelen?.length ? (
                      <>
                        <dt className="text-muted">onderdelen</dt>
                        <dd className="text-xs">{k.scan.onderdelen.join(", ")}</dd>
                      </>
                    ) : null}
                  </dl>
                  {k.component ? (
                    <DoelVinkje ns={ns} id={`${k.scan.namespace}/${k.component.naam}`} label={k.component.weergavenaam} standaard={true} />
                  ) : (
                    <OpnemenKaart
                      ns={ns}
                      id={`${k.scan.namespace}/${k.scan.naam}`}
                      scan={k.scan}
                      voorstel={voorstelVoor(k.scan)}
                      bestaandeNamen={gegevens.bestaandeNamen}
                      lagen={gegevens.lagen}
                      opslaan={opslaan}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {aantal > 0 && (
        <p className="text-xs text-muted">
          De vinkjes "doel voor uitrol" bewaart deze browser, net als de keuzes bij niet-herkende onderdelen
          {opslaan ? " tot je ze in het register opneemt" : "; in het register opnemen kan een redacteur zodra de site een schrijfaccount heeft"}.
        </p>
      )}
    </section>
  );
}

async function StapModel({ i }: { i: Inrichting }) {
  const versies = await modelVersies(i);
  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Welke modelversie hoort bij deze omgeving?</h2>
      <p className="text-sm text-muted">
        Voorlopig kan alleen de actuele versie van het model. De generaties die het register kent staan eronder, zodat de keuze later een oudere versie
        kan worden.
      </p>
      <fieldset className="space-y-2 text-sm">
        <legend className="sr-only">Modelversie</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="model" defaultChecked /> <span className="font-medium">Actuele versie</span>
          {versies[0]?.project && <span className="text-muted">(Studio-project, nu)</span>}
        </label>
        {versies.map((v) => (
          <label key={v.generatie} className="flex items-center gap-2 text-muted">
            <input type="radio" name="model" disabled /> generatie <code>{v.generatie}</code>
            {v.totVolgnummer !== undefined && <span>· tot wijziging {v.totVolgnummer}</span>}
            <span>· {v.artefacten} artefacten</span>
            <span className="text-xs">(later)</span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}

async function StapKoppelingen({ i, ns, opslaan }: { i: Inrichting; ns: string[]; opslaan?: Opslaan }) {
  const [s, model, afgeleid, comps, stand, ids, keuzes] = await Promise.all([
    scan(i, ns),
    modelBoom(i),
    bestaandeKoppelingen(i),
    i.list("componenten").catch(() => []),
    vastgelegdeKoppelingen(i).catch(() => []),
    componentIds(i),
    edienstversieKeuzes(i),
  ]);
  const koppelingen = [...(await vastgelegdAlsKoppeling(i, stand)), ...afgeleid];
  const lagen = await kaartenPerLaag(i, s);
  const hier = new Map(lagen.flatMap((l) => l.kaarten).filter((k) => k.component).map((k) => [k.component!.naam, k] as const));
  // A bare Component ({id, opvoer}, no name yet) is no target: no empty row.
  const doelen = await Promise.all(
    comps.filter((c) => i.componentNaam(c)).map(async (c) => {
      const naam = i.componentNaam(c) ?? "";
      const k = hier.get(naam);
      return {
        component: naam,
        weergavenaam: String(ge(c, "component_namen")?.weergavenaam ?? naam),
        laag: String(ge(c, "component_lagen")?.laag ?? ""),
        draaitHier: Boolean(k),
        adres: k?.scan.adres,
        versie: k?.scan.versie,
        href: await i.href("componenten", c),
      };
    })
  );
  doelen.sort((a, b) => Number(b.draaitHier) - Number(a.draaitHier) || a.laag.localeCompare(b.laag, "nl", { numeric: true }) || a.weergavenaam.localeCompare(b.weergavenaam));
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Koppelingen tussen model en doelen</h2>
        <p className="text-sm text-muted">
          Vastgelegd is wat in het register staat (een Koppeling op de e-dienstversie, voor elke gemeente gelijk); afgeleid is wat volgt uit de
          artefacten (elk gegenereerd artefact koppelt een stuk model aan een component).{" "}
          {opslaan
            ? "Trek een lijn van een entiteit naar een doel om een koppeling te leggen; verleg of wis een vastgelegde lijn."
            : "Lijnen leggen, verleggen en wissen kan een redacteur zodra de site een schrijfaccount heeft."}
        </p>
      </header>
      {s.voorbeeld && <Voorbeeld opgenomen={s.opgenomen} />}
      <KoppelingenScherm
        model={model}
        doelen={doelen.map((d) => ({ ...d, componentId: ids.get(d.component) }))}
        koppelingen={koppelingen}
        bewerken={opslaan ? { opslaan, edienstversies: keuzes } : undefined}
      />
    </section>
  );
}

async function StapTransformaties({ i, ns }: { i: Inrichting; ns: string[] }) {
  const [s, afgeleid, stand] = await Promise.all([scan(i, ns), bestaandeKoppelingen(i), vastgelegdeKoppelingen(i).catch(() => [])]);
  const lagen = await kaartenPerLaag(i, s);
  const draait = new Map(lagen.flatMap((l) => l.kaarten).filter((k) => k.component).map((k) => [k.component!.naam, k.scan.versie] as const));
  const rijen = await transformatieOverzicht(i, draait, [...(await vastgelegdAlsKoppeling(i, stand)), ...afgeleid]);
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Transformaties</h2>
        <p className="text-sm text-muted">
          Wat een koppeling uitvoert: per transformatie haar versies, de code (een verwijzing, niet de tekst) en voor welke componentversies ze
          geldt, met wat er in deze omgeving draait. Een transformatie kiezen of maken volgt later.
        </p>
      </header>
      {s.voorbeeld && <Voorbeeld opgenomen={s.opgenomen} />}
      {!rijen.length && <p className="text-sm text-muted">Het register kent nog geen transformaties.</p>}
      <ul className="grid gap-4 lg:grid-cols-2">
        {rijen.map((t) => (
          <li key={t.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-semibold">{t.naam}</h3>
              {t.identifier && <code className="text-xs text-muted">{t.identifier}</code>}
            </div>
            {t.omschrijving && <p className="mt-1 text-muted">{t.omschrijving}</p>}
            <p className="mt-2 text-xs text-muted">
              van {t.bronSoorten.join(", ") || "?"} naar {t.artefactsoorten.join(", ") || "?"} · gebruikt door {t.gebruik.afgeleid} afgeleide en{" "}
              {t.gebruik.vastgelegd} vastgelegde koppeling{t.gebruik.vastgelegd === 1 ? "" : "en"}
            </p>
            <ul className="mt-3 space-y-2 border-l border-line pl-3">
              {t.versies.map((v) => (
                <li key={v.nummer}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{v.nummer}</span>
                    {v.status && <span className="rounded border border-line px-1.5 text-xs">{v.status}</span>}
                    {v.vorm && <span className="text-xs text-muted">{v.vorm}</span>}
                  </div>
                  <p className="text-xs text-muted">
                    code: {v.pad ? <code>{v.pad}</code> : "—"}
                    {v.verwijzing ? (
                      <>
                        {" "}
                        · <code>{v.verwijzing}</code>
                      </>
                    ) : null}
                    {v.revisie ? (
                      <>
                        {" "}
                        @ <code>{v.revisie}</code>
                      </>
                    ) : (
                      " · verwijzing en revisie nog leeg"
                    )}
                  </p>
                  {v.geldig.length > 0 && (
                    <p className="text-xs">
                      geldt voor{" "}
                      {v.geldig.map((g, n) => (
                        <span key={g.component}>
                          {n > 0 && ", "}
                          {g.weergavenaam}
                          {g.versieRange ? ` ${g.versieRange}` : ""}
                          {g.draaitHier !== undefined ? (
                            <span className="ml-1 rounded bg-accent/15 px-1">draait hier{g.draaitHier ? ` · ${g.draaitHier}` : ""}</span>
                          ) : (
                            <span className="ml-1 text-muted">(niet in deze omgeving)</span>
                          )}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ONDERDELEN: { id: Onderdeel; titel: string }[] = [
  { id: "register", titel: "Register (Omnium)" },
  { id: "ui", titel: "Inrichtingstool (deze site)" },
  { id: "database", titel: "Database" },
];

/** Step 1: what the plugin found on the cluster and which one it uses per part (read only). */
async function StapInstallatie() {
  const { tool, fout } = await inrichtingstool();
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Installatie</h2>
        <p className="text-sm text-muted">
          Wat de plugin op het cluster vond en wat ze gebruikt: per onderdeel een bestaande installatie of een nieuwe. Kiezen en installeren
          gebeurt in de Inrichtingstool-resource of met de CLI van de plugin, niet hier.
        </p>
      </header>
      {fout && <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm">{fout}</p>}
      {tool && (
        <>
          <p className="text-sm">
            Fase <strong>{tool.status.fase ?? "onbekend"}</strong>
            {tool.status.gezochtOp && <span className="text-muted"> · gezocht {new Date(tool.status.gezochtOp).toLocaleString("nl-NL")}</span>}
          </p>
          {tool.status.meldingen?.length ? (
            <ul className="list-disc pl-5 text-sm">
              {tool.status.meldingen.map((m, n) => (
                <li key={n}>{m}</li>
              ))}
            </ul>
          ) : null}
          <ul className="grid gap-4 lg:grid-cols-3">
            {ONDERDELEN.map(({ id, titel }) => {
              const keuze = tool.spec[id];
              const gevonden = tool.status.gevonden?.[id] ?? [];
              return (
                <li key={id} className="rounded-xl border border-line bg-surface p-4 text-sm">
                  <h3 className="font-semibold">{titel}</h3>
                  <p className="mt-1">
                    {!keuze ? (
                      <span className="text-muted">nog geen keuze</span>
                    ) : keuze.gebruik === "nieuw" ? (
                      "een nieuwe installatie"
                    ) : (
                      <>
                        bestaand: <code>{keuze.namespace}/{keuze.naam}</code>
                      </>
                    )}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted">Gevonden ({gevonden.length})</p>
                  <ul className="mt-1 space-y-1">
                    {gevonden.map((v) => {
                      const gekozen = keuze?.gebruik === "bestaand" && keuze.namespace === v.namespace && keuze.naam === v.naam;
                      return (
                        <li key={`${v.namespace}/${v.naam}`} className={gekozen ? "rounded bg-accent/10 px-1 font-medium" : "px-1"}>
                          <code>{v.namespace}/{v.naam}</code>
                          {v.versie && <span className="text-muted"> · {v.versie}</span>}
                          {gekozen && <span className="ml-1 text-xs">(gebruikt)</span>}
                        </li>
                      );
                    })}
                    {!gevonden.length && <li className="text-muted">niets</li>}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
