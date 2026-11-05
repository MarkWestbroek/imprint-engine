import type { OmniumRegister, ReadMoment } from "./client";
import { ge, ownIdKey, refId, relation, type FullRecord } from "./register";

/**
 * The inrichting domain (design/omnium-inrichting.md §3.4): which types there
 * are, and their stable keys. Register ids do not survive a new first filling
 * (3-11-2026), so URLs carry keys, never ids:
 *
 *   componenten/<naam>
 *   ediensten/<naam>
 *   ediensten/<naam>/versies/<versienummer>
 *   ediensten/<naam>/versies/<versienummer>/uitrollen/<gestartOp>
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
  artefactsoorten: { typenaam: "ArtefactSoort", label: "Artefactsoort", meervoud: "Artefactsoorten" },
} as const;

export type Pad = keyof typeof INRICHTING_TYPES;

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
  artefactsoort_standaarddoelcomponenten: "componenten",
};
export const PADS = Object.keys(INRICHTING_TYPES) as Pad[];
export const isPad = (p: string): p is Pad => Object.hasOwn(INRICHTING_TYPES, p);

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
      p = this.register.list(pad, this.at);
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
  identifier = (a: FullRecord | undefined) => str(ge(a, "artefact_identificaties")?.identifier);

  edienstOf = async (v: FullRecord) => this.byId("ediensten", relation(v, "edienstversie_ediensten", own("edienstversies"))[0]?.id);
  versieOfUitrol = async (u: FullRecord) => this.byId("edienstversies", relation(u, "uitrol_edienstversies", own("uitrollen"))[0]?.id);
  versieOfArtefact = async (a: FullRecord) => this.byId("edienstversies", relation(a, "artefact_edienstversies", own("artefacten"))[0]?.id);
  componentOfArtefact = async (a: FullRecord) =>
    this.byId("componenten", relation(a, "artefact_doelcomponenten", own("artefacten"))[0]?.id);
  async soortcode(a: FullRecord): Promise<string | undefined> {
    const soort = await this.byId("artefactsoorten", refId(ge(a, "artefact_identificaties")?.soort));
    return str(ge(soort, "artefactsoort_gegevens")?.code);
  }

  /** The key path of a record (without prefix); undefined when a part is missing. */
  async keyPath(pad: Pad, r: FullRecord): Promise<string[] | undefined> {
    switch (pad) {
      case "componenten":
        return seg(this.componentNaam(r)) ? ["componenten", this.componentNaam(r)!] : undefined;
      case "ediensten":
        return seg(this.edienstNaam(r)) ? ["ediensten", this.edienstNaam(r)!] : undefined;
      case "edienstversies": {
        const e = await this.edienstOf(r);
        const naam = this.edienstNaam(e);
        const nr = this.versienummer(r);
        return naam && nr ? ["ediensten", naam, "versies", nr] : undefined;
      }
      case "uitrollen": {
        const v = await this.versieOfUitrol(r);
        const base = v && (await this.keyPath("edienstversies", v));
        const t = this.gestartOp(r);
        return base && t ? [...base, "uitrollen", t] : undefined;
      }
      case "artefacten": {
        const [soort, comp] = await Promise.all([this.soortcode(r), this.componentOfArtefact(r)]);
        const naam = this.componentNaam(comp);
        const id = this.identifier(r);
        return soort && naam && id ? ["artefacten", soort, naam, id] : undefined;
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
      case "artefactsoorten":
        return str(ge(r, "artefactsoort_gegevens")?.code) ?? `Artefactsoort ${r.id}`;
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
      found = { pad: "ediensten", candidates: (await this.list("ediensten")).filter((e) => this.edienstNaam(e) === p[1]) };
    } else if (head === "ediensten" && p.length === 4 && p[2] === "versies") {
      found = { pad: "edienstversies", candidates: await this.versies(p[1]!, p[3]!) };
    } else if (head === "ediensten" && p.length === 6 && p[2] === "versies" && p[4] === "uitrollen") {
      const versies = await this.versies(p[1]!, p[3]!);
      const ids = new Set(versies.map((v) => v.id));
      const uitrollen = await this.list("uitrollen");
      found = {
        pad: "uitrollen",
        candidates: uitrollen.filter(
          (u) => this.gestartOp(u) === p[5] && ids.has(relation(u, "uitrol_edienstversies", own("uitrollen"))[0]?.id ?? -1)
        ),
      };
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
    const ediensten = (await this.list("ediensten")).filter((e) => this.edienstNaam(e) === edienst);
    if (ediensten.length !== 1) return [];
    const eid = ediensten[0]!.id;
    return (await this.list("edienstversies")).filter(
      (v) => this.versienummer(v) === nr && relation(v, "edienstversie_ediensten", own("edienstversies"))[0]?.id === eid
    );
  }

  /** The way up: e-dienst › versie › uitrol (labels from the path itself). */
  private async crumbs(p: string[]): Promise<{ label: string; href: string }[]> {
    const at = (n: number) => `${this.prefix}/${p.slice(0, n).map(encodeURIComponent).join("/")}`;
    if (p[0] === "ediensten" && p.length >= 4) {
      const out = [{ label: p[1]!, href: at(2) }];
      if (p.length === 6) out.push({ label: `versie ${p[3]}`, href: at(4) });
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
