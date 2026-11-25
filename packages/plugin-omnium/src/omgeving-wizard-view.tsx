import Link from "next/link";
import type { Inrichting } from "./inrichting";
import { ge } from "./register";
import { ALLE, namespaces, scan } from "./omgeving-scan";
import { bestaandeKoppelingen, kaartenPerLaag, LAAG_ONBEKEND, modelBoom, modelVersies, WIZARD_STAPPEN, type WizardStap } from "./omgeving-wizard";
import { DoelVinkje, KoppelingenScherm } from "./omgeving-wizard-client";

/** The omgevingswizard's pages (server). `ns` = the chosen namespaces, carried in the URL from step to step. */
export async function OmgevingWizardView({ i, stap, ns, prefix }: { i: Inrichting; stap: WizardStap; ns: string[]; prefix: string }) {
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
            {k + 2}. {s.titel}
          </Link>
        ))}
      </nav>
      <p role="note" className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
        Alleen bekijken: de wizard schrijft nog niets naar het register of het cluster. Stap 1 (installatie) gebeurt buiten deze site, via de
        plugin.
      </p>
      {stap === "omgeving" && <StapOmgeving i={i} ns={ns} actie={`${basis}/componenten`} />}
      {stap !== "omgeving" && !ns.length && (
        <p className="text-sm">
          Nog geen omgeving gekozen. <Link href={`${basis}/omgeving`} className="text-accent hover:underline">Kies er eerst een →</Link>
        </p>
      )}
      {stap === "componenten" && ns.length > 0 && <StapComponenten i={i} ns={ns} />}
      {stap === "model" && ns.length > 0 && <StapModel i={i} />}
      {stap === "koppelingen" && ns.length > 0 && <StapKoppelingen i={i} ns={ns} />}
      {stap !== "omgeving" && (
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

async function StapComponenten({ i, ns }: { i: Inrichting; ns: string[] }) {
  const s = await scan(i, ns);
  const lagen = await kaartenPerLaag(i, s);
  const aantal = lagen.reduce((n, l) => n + l.kaarten.length, 0);
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Omgeving in beeld</h2>
        <p className="text-sm text-muted">
          {s.namespaces.includes(ALLE) ? "Alle namespaces" : s.namespaces.join(", ")} · {aantal} gevonden · gescand{" "}
          {new Date(s.gescandOp).toLocaleString("nl-NL")}
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
                    <p className="mt-3 text-xs text-muted">
                      {k.scan.herkend ? "Herkend, maar niet in het register: geen doel." : "Niet herkend: geen doel."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {lagen.some((l) => l.laag !== LAAG_ONBEKEND) && (
        <p className="text-xs text-muted">De vinkjes "doel voor uitrol" bewaart deze browser; opslaan in het register volgt.</p>
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

async function StapKoppelingen({ i, ns }: { i: Inrichting; ns: string[] }) {
  const [s, model, koppelingen, comps] = await Promise.all([scan(i, ns), modelBoom(i), bestaandeKoppelingen(i), i.list("componenten").catch(() => [])]);
  const lagen = await kaartenPerLaag(i, s);
  const hier = new Map(lagen.flatMap((l) => l.kaarten).filter((k) => k.component).map((k) => [k.component!.naam, k] as const));
  const doelen = await Promise.all(
    comps.map(async (c) => {
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
          Wat er al is, afgeleid uit de artefacten: elk gegenereerd artefact koppelt een stuk model aan een component. Nieuwe koppelingen leggen,
          verfijnen en een transformatie kiezen volgen zodra het register Koppeling en Transformatie kent.
        </p>
      </header>
      {s.voorbeeld && <Voorbeeld opgenomen={s.opgenomen} />}
      <KoppelingenScherm model={model} doelen={doelen} koppelingen={koppelingen} />
    </section>
  );
}
