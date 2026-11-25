import type { FullRecord } from "./register";
import { ge, geRows, relation } from "./register";
import { own, type Inrichting } from "./inrichting";
import { herken, type Scan, type ScanComponent } from "./omgeving-scan";
import type { VastgelegdeKoppeling } from "./koppeling-register";

/**
 * The omgevingswizard (Fundament docs/inrichtingstool-als-plugin.md §4), read
 * only for now: choose namespaces and scan (step 2), the environment as cards
 * per layer (3), the model version (4), and the links between model and
 * targets as a split view (5). Nothing here writes; saving an Omgeving, its
 * targets and new links waits for the register model (§5) and Mark's yes.
 */

export const WIZARD_STAPPEN = [
  { id: "installatie", titel: "Installatie" },
  { id: "omgeving", titel: "Omgeving kiezen" },
  { id: "componenten", titel: "Omgeving in beeld" },
  { id: "model", titel: "Model koppelen" },
  { id: "koppelingen", titel: "Koppelingen" },
  { id: "transformaties", titel: "Transformaties" },
] as const;
export type WizardStap = (typeof WIZARD_STAPPEN)[number]["id"];
export const isWizardStap = (s: string): s is WizardStap => WIZARD_STAPPEN.some((x) => x.id === s);

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The layers in their order (as on Component in the register); "onbekend" last. */
export const LAAG_ONBEKEND = "niet herkend";

export type Kaart = {
  scan: ScanComponent;
  /** The register's component, when recognised and in the register. */
  component?: { naam: string; weergavenaam: string; laag: string; href?: string };
  /** What the register says runs there (same omgeving name as the namespace), for comparison. */
  registerVersie?: string;
};

export type Laag = { laag: string; kaarten: Kaart[] };

/** The scan as cards per layer. */
export async function kaartenPerLaag(i: Inrichting, scan: Scan): Promise<Laag[]> {
  const comps = await i.list("componenten").catch(() => []);
  const namen = comps.map((c) => i.componentNaam(c) ?? "").filter(Boolean);
  const registerVersies = await registerVersiesPerNamespace(i);
  const lagen = new Map<string, Kaart[]>();
  for (const sc of scan.componenten) {
    const naam = herken(sc, namen);
    const c = naam ? comps.find((x) => i.componentNaam(x) === naam) : undefined;
    const laag = c ? str(ge(c, "component_lagen")?.laag) || "zonder laag" : LAAG_ONBEKEND;
    const kaart: Kaart = {
      scan: sc,
      component: c
        ? { naam: naam!, weergavenaam: str(ge(c, "component_namen")?.weergavenaam) || naam!, laag, href: await i.href("componenten", c) }
        : undefined,
      registerVersie: naam ? registerVersies.get(sc.namespace)?.get(naam) : undefined,
    };
    lagen.set(laag, [...(lagen.get(laag) ?? []), kaart]);
  }
  return [...lagen.entries()]
    .sort(([a], [b]) => (a === LAAG_ONBEKEND ? 1 : b === LAAG_ONBEKEND ? -1 : a.localeCompare(b, "nl", { numeric: true })))
    .map(([laag, kaarten]) => ({ laag, kaarten: kaarten.sort((x, y) => (x.component?.weergavenaam ?? x.scan.naam).localeCompare(y.component?.weergavenaam ?? y.scan.naam)) }));
}

/** Per omgeving name: component name → version, from omgeving_componentversies. */
async function registerVersiesPerNamespace(i: Inrichting): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  for (const o of await i.list("omgevingen").catch(() => [])) {
    const m = new Map<string, string>();
    for (const l of relation(o, "omgeving_componentversies", own("omgevingen"))) {
      const cv = await i.byId("component_versies", l.id).catch(() => undefined);
      const c = cv ? await i.componentOfVersie(cv) : undefined;
      if (c && i.componentNaam(c)) m.set(i.componentNaam(c)!, i.versienummerVan(cv) ?? "");
    }
    out.set(await i.title("omgevingen", o), m);
  }
  return out;
}

/** The model versions the register has seen: the generations (ArtefactHerkomst), newest first. */
export type ModelVersie = { generatie: string; project?: string; totVolgnummer?: number; artefacten: number };

export async function modelVersies(i: Inrichting): Promise<ModelVersie[]> {
  const per = new Map<string, ModelVersie>();
  for (const a of await i.list("artefacten")) {
    const h = ge(a, "artefact_herkomsten");
    const generatie = str(h?.generatie);
    if (!generatie) continue;
    const v = per.get(generatie) ?? { generatie, project: str(h?.studioProjectId) || undefined, totVolgnummer: typeof h?.totVolgnummer === "number" ? h.totVolgnummer : undefined, artefacten: 0 };
    v.artefacten++;
    if (typeof h?.totVolgnummer === "number" && (v.totVolgnummer ?? -1) < h.totVolgnummer) v.totVolgnummer = h.totVolgnummer;
    per.set(generatie, v);
  }
  return [...per.values()].sort((a, b) => b.generatie.localeCompare(a.generatie));
}

// ── Step 5: the split view ─────────────────────────────────────────────────

export type ModelKnoop = { id: string; label: string; soort: string; kinderen: ModelKnoop[]; href?: string };

const parse = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

type El = { id?: string; naam?: string; elementType?: string; source?: string; target?: string; data?: Record<string, unknown> };

/**
 * The model as a tree: domein → entiteit → gegevenselement (with its fields),
 * from the newest logical model; then the sources per kind (processes,
 * decisions, forms), from the register's source artefacts.
 */
export async function modelBoom(i: Inrichting): Promise<ModelKnoop[]> {
  const bronnen: { a: FullRecord; soort: string }[] = [];
  for (const a of await i.list("artefacten")) if ((await i.richting(a)) === "bron") bronnen.push({ a, soort: (await i.soortcode(a)) ?? "" });
  const lm = bronnen.filter((b) => b.soort === "logisch-model").sort((x, y) => str(y.a.opvoer).localeCompare(str(x.a.opvoer)))[0];
  const payload = lm ? (parse(ge(lm.a, "artefact_inhouden")?.payload) as { profielen?: Record<string, { elements?: Record<string, El> }> }) : undefined;
  const elements = Object.entries(payload?.profielen?.diagram05?.elements ?? {}).map(([id, e]) => ({ ...e, id: e.id ?? id }));
  const byId = new Map(elements.map((e) => [e.id!, e]));
  const ges = new Map<string, El[]>(); // owner → GEs (compositie: source owns target)
  for (const e of elements) {
    if (e.elementType !== "compositie" || !e.source || !e.target) continue;
    const t = byId.get(e.target);
    if (t?.elementType === "gegevenselement") ges.set(e.source, [...(ges.get(e.source) ?? []), t]);
  }
  const velden = (e: El): ModelKnoop[] =>
    ((e.data?.bron as { velden?: { naam?: string; type?: string }[] } | undefined)?.velden ?? [])
      .filter((v) => v.naam)
      .map((v) => ({ id: `${e.id}.${v.naam}`, label: v.naam!, soort: "veld", kinderen: [] }));
  const domeinen = new Map<string, ModelKnoop[]>();
  for (const e of elements.filter((x) => x.elementType === "entiteit")) {
    const domein = str((e.data?.bron as { domein?: string } | undefined)?.domein) || "zonder domein";
    const knoop: ModelKnoop = {
      id: e.id!,
      label: e.naam ?? e.id!,
      soort: "entiteit",
      kinderen: [...velden(e), ...(ges.get(e.id!) ?? []).map((g) => ({ id: g.id!, label: g.naam ?? g.id!, soort: "gegevenselement", kinderen: velden(g) }))],
    };
    domeinen.set(domein, [...(domeinen.get(domein) ?? []), knoop]);
  }
  const boom: ModelKnoop[] = [...domeinen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, kinderen]) => ({ id: `domein:${d}`, label: d, soort: "domein", kinderen: kinderen.sort((x, y) => x.label.localeCompare(y.label)) }));

  const SOORTEN: Record<string, string> = { "bpmn-bron": "Processen", "dmn-bron": "Beslistabellen", edienstmodel: "E-dienstmodellen" };
  for (const [soort, label] of Object.entries(SOORTEN)) {
    const lijst = bronnen.filter((b) => b.soort === soort);
    if (!lijst.length) continue;
    boom.push({
      id: `bron:${soort}`,
      label,
      soort: "groep",
      kinderen: await Promise.all(lijst.map(async (b) => ({ id: `artefact:${b.a.id}`, label: await i.title("artefacten", b.a), soort, kinderen: [], href: await i.href("artefacten", b.a) }))),
    });
  }
  return boom;
}

export type Koppeling = {
  id: string;
  /** A describing name: "Objecttype Aanvraag". */
  naam: string;
  soort: string;
  /** The model side: the e-dienstversie and the sources it came from. */
  bron: { label: string; ids: string[] };
  /** The target: the component (its register name). */
  doel: { component: string; weergavenaam: string };
  href?: string;
  /** Derived from an artefact (the default), or laid down in the register (a Koppeling, schema v8). */
  herkomst?: "artefact" | "register";
  /** For a laid-down link: its register id and the e-dienstversies it hangs on. */
  registerId?: number;
  edienstversieIds?: number[];
};

/** The links there are already: every generated artefact is model → component (artefact → bron and doelcomponent). */
export async function bestaandeKoppelingen(i: Inrichting): Promise<Koppeling[]> {
  const out: Koppeling[] = [];
  const artefacten = await i.list("artefacten");
  const byId = new Map(artefacten.map((a) => [a.id, a]));
  for (const a of artefacten) {
    if ((await i.richting(a)) !== "gegenereerd") continue;
    const c = await i.componentOfArtefact(a);
    if (!c) continue;
    const versie = await i.versieOfArtefact(a);
    const bronnen = i.bronnenVan(a).map((b) => byId.get(b.id)).filter((x): x is FullRecord => Boolean(x));
    const bronLabels = await Promise.all(bronnen.map((b) => i.title("artefacten", b)));
    out.push({
      id: `artefact:${a.id}`,
      naam: str(ge(a, "artefact_identificaties")?.naam) || i.identifier(a) || `Artefact ${a.id}`,
      soort: (await i.soortcode(a)) ?? "",
      bron: {
        label: [versie ? await i.title("edienstversies", versie) : undefined, ...bronLabels].filter(Boolean).join(" · ") || "het model",
        ids: [...bronnen.map((b) => `artefact:${b.id}`), ...(await bronElementen(a))],
      },
      doel: { component: i.componentNaam(c) ?? "", weergavenaam: str(ge(c, "component_namen")?.weergavenaam) || (i.componentNaam(c) ?? "") },
      href: await i.href("artefacten", a),
    });
  }
  return out.sort((x, y) => x.doel.weergavenaam.localeCompare(y.doel.weergavenaam) || x.naam.localeCompare(y.naam));
}

/** The model elements a result reads (its traceregels' bronElementId): lit up on the left when the link is chosen. */
async function bronElementen(a: FullRecord): Promise<string[]> {
  const ids = new Set<string>();
  for (const t of geRows(a, "artefact_traceregels")) if (typeof t.bronElementId === "string" && t.bronElementId) ids.add(t.bronElementId);
  return [...ids];
}

// ── Step 6: the transformations (read only) ────────────────────────────────

export type TransformatieRij = {
  id: number;
  identifier: string;
  naam: string;
  omschrijving?: string;
  bronSoorten: string[];
  artefactsoorten: string[];
  versies: {
    nummer: string;
    vorm?: string;
    pad?: string;
    verwijzing?: string;
    revisie?: string;
    status?: string;
    geldig: { component: string; weergavenaam: string; versieRange?: string; draaitHier?: string }[];
  }[];
  /** How many links use it: derived (an artefact of one of its soorten) and laid down in the register. */
  gebruik: { afgeleid: number; vastgelegd: number };
};

/** Every transformation with its versions; per version where it holds and whether that component runs in the chosen omgeving. */
export async function transformatieOverzicht(i: Inrichting, draaitHier: Map<string, string | undefined>, koppelingen: Koppeling[]): Promise<TransformatieRij[]> {
  const [trs, versies, soorten, comps, kps] = await Promise.all([
    i.list("transformaties").catch(() => []),
    i.list("transformatieversies").catch(() => []),
    i.list("artefactsoorten").catch(() => []),
    i.list("componenten").catch(() => []),
    i.list("koppelingen").catch(() => []),
  ]);
  const soortCode = new Map(soorten.map((s) => [s.id, str(ge(s, "artefactsoort_gegevens")?.code)] as const));
  const comp = new Map(comps.map((c) => [c.id, c] as const));
  const out: TransformatieRij[] = [];
  for (const t of trs) {
    const n = ge(t, "transformatie_namen");
    const codes = relation(t, "transformatie_artefactsoorten", own("transformaties")).map((l) => soortCode.get(l.id) ?? "").filter(Boolean);
    const vs = relation(t, "transformatie_heeft_versies", own("transformaties")).flatMap((l) => versies.filter((v) => v.id === l.id));
    out.push({
      id: t.id,
      identifier: str(n?.identifier),
      naam: str(n?.naam) || str(n?.identifier) || `Transformatie ${t.id}`,
      omschrijving: str(n?.omschrijving) || undefined,
      bronSoorten: geRows(t, "transformatie_bronnen").map((b) => str(b.bronSoort)).filter(Boolean),
      artefactsoorten: codes,
      versies: vs
        .map((v) => {
          const c = ge(v, "transformatieversie_codes");
          return {
            nummer: str(ge(v, "transformatieversie_nummers")?.versienummer) || `#${v.id}`,
            vorm: str(c?.vorm) || undefined,
            pad: str(c?.pad) || undefined,
            verwijzing: str(c?.verwijzing) || undefined,
            revisie: str(c?.revisie) || undefined,
            status: str(ge(v, "transformatieversie_verlopen")?.status) || undefined,
            geldig: geRows(v, "transformatieversie_componentgeldigheden").flatMap((g) => {
              const cc = typeof g.component_id === "number" ? comp.get(g.component_id) : undefined;
              const naam = cc ? (i.componentNaam(cc) ?? "") : "";
              return naam
                ? [{ component: naam, weergavenaam: str(ge(cc, "component_namen")?.weergavenaam) || naam, versieRange: str(g.versieRange) || undefined, draaitHier: draaitHier.has(naam) ? (draaitHier.get(naam) ?? "") : undefined }]
                : [];
            }),
          };
        })
        .sort((a, b) => b.nummer.localeCompare(a.nummer, "nl", { numeric: true })),
      gebruik: {
        afgeleid: koppelingen.filter((k) => k.herkomst !== "register" && codes.includes(k.soort)).length,
        vastgelegd: kps.filter((k) => relation(k, "koppeling_transformaties", own("koppelingen")).some((l) => l.id === t.id)).length,
      },
    });
  }
  return out.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

/** The links laid down in the register, in the view's shape (soort "vastgelegd"), with what the editor needs to change them. */
export async function vastgelegdAlsKoppeling(i: Inrichting, stand: VastgelegdeKoppeling[]): Promise<Koppeling[]> {
  const comps = await i.list("componenten").catch(() => []);
  const versies = await i.list("edienstversies").catch(() => []);
  const out: Koppeling[] = [];
  for (const k of stand) {
    const c = comps.find((x) => x.id === k.doel?.component_id);
    if (!c) continue;
    const labels = await Promise.all(k.edienstversies.map(async (v) => { const r = versies.find((x) => x.id === v.edienstversie_id); return r ? i.title("edienstversies", r) : undefined; }));
    out.push({
      id: `koppeling:${k.id}`,
      naam: k.naam,
      soort: "vastgelegd",
      herkomst: "register",
      registerId: k.id,
      edienstversieIds: k.edienstversies.map((v) => v.edienstversie_id),
      bron: { label: labels.filter(Boolean).join(" · ") || "het model", ids: k.bronnen.map((b) => b.bronElementId) },
      doel: { component: i.componentNaam(c) ?? "", weergavenaam: str(ge(c, "component_namen")?.weergavenaam) || (i.componentNaam(c) ?? "") },
    });
  }
  return out;
}
