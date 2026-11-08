import type { OmniumRegister, ReadMoment } from "./client";
import { asAt, ge, momentOf, ownIdKey, refId, relation, type FullRecord } from "./register";

/**
 * The inrichting domain (design/omnium-inrichting.md §3.4): which types there
 * are, and their stable keys. Register ids do not survive a new first filling
 * (3-11-2026), so URLs carry keys, never ids:
 *
 *   componenten/<naam>
 *   ediensten/<naam>
 *   ediensten/<naam>/versies/<versienummer>
 *   ediensten/<naam>/versies/<versienummer>/uitrollen/<gestartOp>
 *
 * Once the model has them (Mark, 5-11-2026), `EdienstNaam.code` takes the
 * place of the name and `UitrolIdentificatie.uuid` (json key expected: uitrol_identificaties) that of `gestartOp`; both are
 * optional at first, so a record without one keeps the old key, and an old
 * link (by name, by start time) still finds its record.
 *   artefacten/<soortcode>/<component>/<identifier>
 *
 * Only Component and EDienst have a key of their own; a version, an artefact
 * and an uitrol are known through their relations. Keys are matched exactly
 * in the client over the whole list (the register's filter is an ILIKE on id
 * columns only); no match is null, more than one an `AmbiguousKey`.
 */

export const INRICHTING_TYPES = {
  componenten: { typenaam: "Component", label: "Component", meervoud: "Componenten" },
  ediensten: { typenaam: "EDienst", label: "E-dienst", meervoud: "E-diensten" },
  edienstversies: { typenaam: "EDienstVersie", label: "E-dienstversie", meervoud: "E-dienstversies" },
  artefacten: { typenaam: "Artefact", label: "Artefact", meervoud: "Artefacten" },
  uitrollen: { typenaam: "Uitrol", label: "Uitrol", meervoud: "Uitrollen" },
  omgevingen: { typenaam: "Omgeving", label: "Omgeving", meervoud: "Omgevingen" },
  component_versies: { typenaam: "ComponentVersie", label: "Componentversie", meervoud: "Componentversies" },
  artefactsoorten: { typenaam: "ArtefactSoort", label: "Artefactsoort", meervoud: "Artefactsoorten" },
  artefactformaten: { typenaam: "ArtefactFormaat", label: "Artefactformaat", meervoud: "Artefactformaten" },
} as const;

export type Pad = keyof typeof INRICHTING_TYPES;
export type Richting = "bron" | "gegenereerd" | "weergave";

/** Where a relation (by json name) points, so a row or link can go to its page. */
export const RELATION_TARGET: Record<string, Pad> = {
  edienstversie_ediensten: "ediensten",
  edienstversie_componentvereisten: "componenten",
  artefact_edienstversies: "edienstversies",
  artefact_doelcomponenten: "componenten",
  artefact_afhankelijkheden: "artefacten",
  uitrol_edienstversies: "edienstversies",
  uitrol_omgevingen: "omgevingen",
  uitrol_resultaten: "artefacten",
  // Bronnen (model change 5-11-2026, expected key): generated → source, SVG → source.
  artefact_bronnen: "artefacten",
  artefactsoort_standaarddoelcomponenten: "componenten",
  // Schema v3 (6-11-2026): soort and formaat become relations instead of `$ref` fields.
  artefact_artefactsoorten: "artefactsoorten",
  artefact_artefactformaten: "artefactformaten",
  component_artefactsoorten: "artefactsoorten",
  // What runs where (6-11-2026): an omgeving links component versions (materieel), a version its component.
  omgeving_componentversies: "component_versies",
  componentversie_componenten: "componenten",
};
export const PADS = Object.keys(INRICHTING_TYPES) as Pad[];
export const isPad = (p: string): p is Pad => Object.hasOwn(INRICHTING_TYPES, p);

/** Fields that hold a referentielijst id (`$ref`), and the list whose title stands for it. */
export const REF_FIELDS: Record<string, Pad> = { soort: "artefactsoorten", formaat: "artefactformaten" };

/** Ids of the owner type, for reading its relations. */
export const own = (pad: Pad) => ownIdKey(INRICHTING_TYPES[pad].typenaam);
const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? undefined : String(v));

export class AmbiguousKey extends Error {
  constructor(readonly path: string, readonly count: number) {
    super(`${count} records answer to ${path}`);
    this.name = "AmbiguousKey";
  }
}

/** A record as the site addresses it. */
export type Located = { pad: Pad; record: FullRecord; title: string; href: string; crumbs: { label: string; href: string }[] };

/**
 * The register as the site walks it: the lists it needs, loaded once (per
 * request — the register is small, tens of records), and the keys between
 * them. `prefix` is where the site mounts it ("/inrichting").
 */
export class Inrichting {
  private lists = new Map<Pad, Promise<FullRecord[]>>();

  constructor(
    private readonly register: OmniumRegister,
    readonly prefix = "/inrichting",
    readonly at: ReadMoment = {}
  ) {}

  list(pad: Pad): Promise<FullRecord[]> {
    let p = this.lists.get(pad);
    if (!p) {
      const at = momentOf(this.at.geldigOp);
      p = this.register.list(pad, this.at).then((rows) => rows.map((r) => asAt(r, at)));
      this.lists.set(pad, p);
    }
    return p;
  }

  async byId(pad: Pad, id: number | undefined): Promise<FullRecord | undefined> {
    if (id === undefined) return undefined;
    return (await this.list(pad)).find((r) => r.id === id);
  }

  // ── keys ────────────────────────────────────────────────────────────────
  componentNaam = (c: FullRecord | undefined) => str(ge(c, "component_namen")?.naam);
  edienstNaam = (e: FullRecord | undefined) => str(ge(e, "edienst_namen")?.naam);
  versienummer = (v: FullRecord | undefined) => str(ge(v, "edienstversie_nummers")?.versienummer);
  gestartOp = (u: FullRecord | undefined) => str(ge(u, "uitrol_verlopen")?.gestartOp);
  /** The URL key: the code when there is one, else the name. */
  edienstSleutel = (e: FullRecord | undefined) => str(ge(e, "edienst_namen")?.code) || this.edienstNaam(e);
  /** The URL key: the uuid when there is one, else the start time. */
  uitrolSleutel = (u: FullRecord | undefined) => str(ge(u, "uitrol_identificaties")?.uuid) || this.gestartOp(u);
  /** By key, else by the older key (name, start time): links made before the code or uuid keep working. */
  private byKey<T extends FullRecord>(rows: T[], key: (r: T) => string | undefined, old: (r: T) => string | undefined, want: string): T[] {
    const hit = rows.filter((r) => key(r) === want);
    return hit.length ? hit : rows.filter((r) => old(r) === want);
  }
  identifier = (a: FullRecord | undefined) => str(ge(a, "artefact_identificaties")?.identifier);

  edienstOf = async (v: FullRecord) => this.byId("ediensten", relation(v, "edienstversie_ediensten", own("edienstversies"))[0]?.id);
  versieOfUitrol = async (u: FullRecord) => this.byId("edienstversies", relation(u, "uitrol_edienstversies", own("uitrollen"))[0]?.id);
  versieOfArtefact = async (a: FullRecord) => this.byId("edienstversies", relation(a, "artefact_edienstversies", own("artefacten"))[0]?.id);
  componentOfArtefact = async (a: FullRecord) =>
    this.byId("componenten", relation(a, "artefact_doelcomponenten", own("artefacten"))[0]?.id);
  versienummerVan = (cv: FullRecord | undefined) => str(ge(cv, "componentversie_nummers")?.versienummer);
  componentOfVersie = async (cv: FullRecord) =>
    this.byId("componenten", relation(cv, "componentversie_componenten", own("component_versies"))[0]?.id);

  /** The omgevingen where a component version runs now (`omgeving_componentversies` without einde), with its API root there. */
  async omgevingenVan(cv: FullRecord): Promise<{ omgeving: FullRecord; apiRoot?: string }[]> {
    return (await this.list("omgevingen").catch(() => [])).flatMap((o) =>
      relation(o, "omgeving_componentversies", own("omgevingen"))
        .filter((l) => l.id === cv.id)
        .map((l) => ({ omgeving: o, apiRoot: str(l.velden.apiRoot) }))
    );
  }

  /** What runs of a component now: per omgeving its version (empty when the register has none). */
  async draaitVan(c: FullRecord): Promise<{ omgeving: string; versie?: string }[]> {
    const out: { omgeving: string; versie?: string }[] = [];
    for (const o of await this.list("omgevingen").catch(() => [])) {
      for (const l of relation(o, "omgeving_componentversies", own("omgevingen"))) {
        const cv = await this.byId("component_versies", l.id).catch(() => undefined);
        if (cv && (await this.componentOfVersie(cv))?.id === c.id) out.push({ omgeving: await this.title("omgevingen", o), versie: this.versienummerVan(cv) });
      }
    }
    return out;
  }

  /** The artefactsoort: the relation (schema v3), else the `$ref` field `soort` (v2). */
  soortOf = async (a: FullRecord) =>
    this.byId(
      "artefactsoorten",
      relation(a, "artefact_artefactsoorten", own("artefacten"))[0]?.id ?? refId(ge(a, "artefact_identificaties")?.soort)
    );
  async soortcode(a: FullRecord): Promise<string | undefined> {
    return str(ge(await this.soortOf(a), "artefactsoort_gegevens")?.code);
  }

  /** What an artefact is (model v3, 6-11-2026): a `bron`, a `weergave` of one (an SVG), or `gegenereerd` (also when empty). */
  async richting(a: FullRecord): Promise<Richting> {
    const r = str(ge(await this.soortOf(a), "artefactsoort_gegevens")?.richting);
    return r === "bron" || r === "weergave" ? r : "gegenereerd";
  }

  /** The sources an artefact was made from (`artefact_bronnen`, rol bron), or the source a drawing shows (rol weergave-van). */
  bronnenVan(a: FullRecord): { id: number; rol: string; bronHash?: string }[] {
    return relation(a, "artefact_bronnen", own("artefacten")).map((l) => ({ id: l.id, rol: str(l.velden.rol) ?? "bron", bronHash: str(l.velden.bronHash) }));
  }

  /** Where the latest uitrol put this artefact (`uitrol_resultaten.doelUrl`), newest `tijdstip` first. */
  async doelUrl(a: FullRecord): Promise<string | undefined> {
    let best: { url: string; t: string } | undefined;
    for (const u of await this.list("uitrollen")) {
      for (const l of relation(u, "uitrol_resultaten", own("uitrollen"))) {
        const url = str(l.velden.doelUrl);
        const t = str(l.velden.tijdstip) ?? "";
        if (l.id === a.id && url && (!best || t >= best.t)) best = { url, t };
      }
    }
    return best?.url;
  }

  /**
   * The live page of an artefact, where there is one: an Open Formulieren form
   * is at `<host>/<slug>/`, the host taken from where the uitrol put it (the
   * API URL), the slug from the form definition (else its identifier).
   */
  async liveUrl(a: FullRecord): Promise<string | undefined> {
    if ((await this.soortcode(a)) !== "formulier") return undefined;
    const doel = await this.doelUrl(a);
    if (!doel) return undefined;
    let slug: string | undefined;
    try {
      const payload = ge(a, "artefact_inhouden")?.payload;
      const forms = (typeof payload === "string" ? JSON.parse(payload) : payload)?.["forms.json"];
      slug = str((Array.isArray(forms) ? forms[0] : forms)?.slug);
    } catch {
      // Not JSON: fall back to the identifier.
    }
    slug ??= this.identifier(a);
    try {
      return slug ? `${new URL(doel).origin}/${encodeURIComponent(slug)}/` : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * From a traceregel of this artefact to the element in a drawing of one of
   * its sources: `bronElementId` when the transformation filled it (BPMN, DMN,
   * proceskoppeling), else the gegevenselement or entity the `bronGE` names
   * (`Entity.GE.veld` → `Entity_GE`, else `Entity`), as the render service
   * names them in `data-element-id`. Returns a function, so a table of
   * traceregels looks the drawings up once.
   */
  /**
   * The drawings of an artefact's sources (rol bron → their weergaven),
   * smallest first, and per traceregel the element in one of them: by
   * `bronElementId`, else `Entity_GE` or `Entity` from `bronGE`; on a
   * gegevenselement also its field (the third part of `bronGE`).
   */
  async elementFinder(a: FullRecord): Promise<{
    drawings: { record: FullRecord; href: string; ids: Set<string>; svg: string }[];
    find: (t: Record<string, unknown>) => { d: number; id: string; veld?: string; href: string } | undefined;
  }> {
    const drawings: { record: FullRecord; href: string; ids: Set<string>; svg: string }[] = [];
    for (const b of this.bronnenVan(a).filter((x) => x.rol === "bron")) {
      const bron = await this.byId("artefacten", b.id);
      if (!bron) continue;
      for (const t of await this.weergavenVan(bron)) {
        const href = await this.href("artefacten", t);
        const svg = ge(t, "artefact_inhouden")?.payload;
        if (href && typeof svg === "string") drawings.push({ record: t, href, svg, ids: new Set(Array.from(svg.matchAll(/data-element-id="([^"]+)"/g), (m) => m[1]!)) });
      }
    }
    // The smallest drawing that has the element: a domain diagram of a few blocks reads better than an overview of 87.
    drawings.sort((x, y) => x.ids.size - y.ids.size);
    const find = (t: Record<string, unknown>) => {
      const parts = (str(t.bronGE) ?? "").split(".");
      const ge = parts.length >= 2 ? `${parts[0]}_${parts[1]}` : undefined;
      const wanted = [str(t.bronElementId), ge, parts[0]].filter((x): x is string => Boolean(x));
      for (const id of wanted) {
        const d = drawings.findIndex((x) => x.ids.has(id));
        if (d < 0) continue;
        const veld = id === ge && parts[2] ? parts[2] : undefined;
        return { d, id, veld, href: `${drawings[d]!.href}?element=${encodeURIComponent(id)}${veld ? `&veld=${encodeURIComponent(veld)}` : ""}` };
      }
      return undefined;
    };
    return { drawings, find };
  }

  /** Per traceregel a link to its element in a drawing of the sources (see `elementFinder`). */
  async elementLink(a: FullRecord): Promise<(t: Record<string, unknown>) => string | undefined> {
    const { find } = await this.elementFinder(a);
    return (t) => find(t)?.href;
  }


  /** The drawings of a source: the artefacts that point at it with rol weergave-van (the source has no key back). */
  async weergavenVan(bron: FullRecord): Promise<FullRecord[]> {
    return (await this.list("artefacten")).filter((a) => this.bronnenVan(a).some((b) => b.id === bron.id && b.rol === "weergave-van"));
  }

  /** The key path of a record (without prefix); undefined when a part is missing. */
  async keyPath(pad: Pad, r: FullRecord): Promise<string[] | undefined> {
    switch (pad) {
      case "componenten":
        return seg(this.componentNaam(r)) ? ["componenten", this.componentNaam(r)!] : undefined;
      case "ediensten":
        return seg(this.edienstSleutel(r)) ? ["ediensten", this.edienstSleutel(r)!] : undefined;
      case "edienstversies": {
        const e = await this.edienstOf(r);
        const naam = this.edienstSleutel(e);
        const nr = this.versienummer(r);
        return naam && nr ? ["ediensten", naam, "versies", nr] : undefined;
      }
      case "uitrollen": {
        const v = await this.versieOfUitrol(r);
        const base = v && (await this.keyPath("edienstversies", v));
        const t = this.uitrolSleutel(r);
        return base && t ? [...base, "uitrollen", t] : undefined;
      }
      case "artefacten": {
        const [soort, comp] = await Promise.all([this.soortcode(r), this.componentOfArtefact(r)]);
        const id = this.identifier(r);
        if (!soort || !id) return undefined;
        // Rolled out to a component: by component. A source or a drawing has none: under its version.
        if (comp) {
          const naam = this.componentNaam(comp);
          return naam ? ["artefacten", soort, naam, id] : undefined;
        }
        const v = await this.versieOfArtefact(r);
        const base = v && (await this.keyPath("edienstversies", v));
        return base ? [...base, "bronnen", soort, id] : undefined;
      }
      default:
        return undefined;
    }
  }

  async href(pad: Pad, r: FullRecord): Promise<string | undefined> {
    const path = await this.keyPath(pad, r);
    return path && `${this.prefix}/${path.map(encodeURIComponent).join("/")}`;
  }

  /** A readable title, for headings and links. */
  async title(pad: Pad, r: FullRecord): Promise<string> {
    switch (pad) {
      case "componenten":
        return str(ge(r, "component_namen")?.weergavenaam) ?? this.componentNaam(r) ?? `Component ${r.id}`;
      case "ediensten":
        return this.edienstNaam(r) ?? `E-dienst ${r.id}`;
      case "edienstversies":
        return `${this.edienstNaam(await this.edienstOf(r)) ?? "E-dienst"} ${this.versienummer(r) ?? `#${r.id}`}`;
      case "artefacten":
        return str(ge(r, "artefact_identificaties")?.naam) ?? this.identifier(r) ?? `Artefact ${r.id}`;
      case "uitrollen":
        return `Uitrol ${this.gestartOp(r) ?? `#${r.id}`}`;
      case "omgevingen":
        return str(ge(r, "omgeving_namen")?.naam) ?? `Omgeving ${r.id}`;
      case "component_versies": {
        const c = await this.componentOfVersie(r);
        return `${c ? await this.title("componenten", c) : "Component"} ${this.versienummerVan(r) ?? `#${r.id}`}`;
      }
      case "artefactsoorten":
        return str(ge(r, "artefactsoort_gegevens")?.code) ?? `Artefactsoort ${r.id}`;
      case "artefactformaten":
        return str(ge(r, "artefactformaat_gegevens")?.code) ?? `Artefactformaat ${r.id}`;
    }
  }

  /** From the URL path (after the prefix) to the record; null = no such record. */
  async locate(path: string[]): Promise<Located | null> {
    const p = path.map(decode);
    const [head] = p;
    let found: { pad: Pad; candidates: FullRecord[] } | null = null;

    if (head === "componenten" && p.length === 2) {
      found = { pad: "componenten", candidates: (await this.list("componenten")).filter((c) => this.componentNaam(c) === p[1]) };
    } else if (head === "ediensten" && p.length === 2) {
      found = { pad: "ediensten", candidates: this.byKey(await this.list("ediensten"), this.edienstSleutel, this.edienstNaam, p[1]!) };
    } else if (head === "ediensten" && p.length === 4 && p[2] === "versies") {
      found = { pad: "edienstversies", candidates: await this.versies(p[1]!, p[3]!) };
    } else if (head === "ediensten" && p.length === 6 && p[2] === "versies" && p[4] === "uitrollen") {
      const versies = await this.versies(p[1]!, p[3]!);
      const ids = new Set(versies.map((v) => v.id));
      const uitrollen = await this.list("uitrollen");
      found = {
        pad: "uitrollen",
        candidates: this.byKey(
          uitrollen.filter((u) => ids.has(relation(u, "uitrol_edienstversies", own("uitrollen"))[0]?.id ?? -1)),
          this.uitrolSleutel,
          this.gestartOp,
          p[5]!
        ),
      };
    } else if (head === "ediensten" && p.length === 7 && p[2] === "versies" && p[4] === "bronnen") {
      const ids = new Set((await this.versies(p[1]!, p[3]!)).map((v) => v.id));
      const candidates: FullRecord[] = [];
      for (const a of await this.list("artefacten")) {
        if (this.identifier(a) !== p[6] || !ids.has(relation(a, "artefact_edienstversies", own("artefacten"))[0]?.id ?? -1)) continue;
        if ((await this.componentOfArtefact(a)) === undefined && (await this.soortcode(a)) === p[5]) candidates.push(a);
      }
      found = { pad: "artefacten", candidates };
    } else if (head === "artefacten" && p.length === 4) {
      const candidates: FullRecord[] = [];
      for (const a of await this.list("artefacten")) {
        if (this.identifier(a) !== p[3]) continue;
        const [soort, comp] = await Promise.all([this.soortcode(a), this.componentOfArtefact(a)]);
        if (soort === p[1] && this.componentNaam(comp) === p[2]) candidates.push(a);
      }
      found = { pad: "artefacten", candidates };
    }

    if (!found || found.candidates.length === 0) return null;
    if (found.candidates.length > 1) throw new AmbiguousKey(`${this.prefix}/${path.join("/")}`, found.candidates.length);
    const record = found.candidates[0]!;
    return {
      pad: found.pad,
      record,
      title: await this.title(found.pad, record),
      href: `${this.prefix}/${p.map(encodeURIComponent).join("/")}`,
      crumbs: await this.crumbs(p),
    };
  }

  private async versies(edienst: string, nr: string): Promise<FullRecord[]> {
    const ediensten = this.byKey(await this.list("ediensten"), this.edienstSleutel, this.edienstNaam, edienst);
    if (ediensten.length !== 1) return [];
    const eid = ediensten[0]!.id;
    return (await this.list("edienstversies")).filter(
      (v) => this.versienummer(v) === nr && relation(v, "edienstversie_ediensten", own("edienstversies"))[0]?.id === eid
    );
  }

  /** The way up: e-dienst › versie (the e-dienst by its name, also when the path has its code). */
  private async crumbs(p: string[]): Promise<{ label: string; href: string }[]> {
    const at = (n: number) => `${this.prefix}/${p.slice(0, n).map(encodeURIComponent).join("/")}`;
    if (p[0] === "ediensten" && p.length >= 4) {
      const [e] = this.byKey(await this.list("ediensten"), this.edienstSleutel, this.edienstNaam, p[1]!);
      const out = [{ label: this.edienstNaam(e) ?? p[1]!, href: at(2) }];
      if (p.length >= 6) out.push({ label: `versie ${p[3]}`, href: at(4) });
      return out;
    }
    return [];
  }
}

const seg = (s: string | undefined) => Boolean(s && s.trim());

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
