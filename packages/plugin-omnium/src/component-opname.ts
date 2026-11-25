import type { ScanComponent } from "./omgeving-scan";
import type { Registratie } from "./koppeling-register";

/**
 * Taking an unrecognised workload into the register as a Component (step 3 of
 * the omgevingswizard). For now the choice is kept in the browser only; writing
 * it to the register comes later, behind the same writing account as the lines.
 * The register enforces nothing on a Component (BACKEND 25-11-2026), so the
 * site checks it all before saving: name and display name, a known layer, at
 * least one recognition rule with a valid pattern, and no Component with the
 * same name yet. Pure: no store, no fetch.
 */

export type HerkenningSoort = "image" | "chart";

export type Opname = {
  /** The component name as the register keys it (component_namen.naam). */
  naam: string;
  weergavenaam: string;
  laag: string;
  herkenning: { soort: HerkenningSoort; patroon: string };
  /** Target for transformation and push in this environment. */
  doel: boolean;
};

/** The image without registry digest or tag: what the plugin matches a pattern against. */
export function imageZonderTag(image: string): string {
  const zonderDigest = image.split("@")[0]!;
  const laatste = zonderDigest.lastIndexOf("/");
  const dubbelepunt = zonderDigest.indexOf(":", laatste + 1);
  return dubbelepunt === -1 ? zonderDigest : zonderDigest.slice(0, dubbelepunt);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A register-style name: lower case, words joined by a hyphen. */
export function alsNaam(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The starting point for the form: the plugin's proposal when it has one
 * (plugin v0.10.0, `voorstel`), else derived from the workload itself.
 */
export function voorstelVoor(sc: ScanComponent): Opname {
  const v = sc.voorstel;
  const soort: HerkenningSoort = v?.soort ?? (sc.image ? "image" : "chart");
  const bron = soort === "image" ? (sc.image ? imageZonderTag(sc.image) : "") : sc.chart ?? "";
  const naam = alsNaam(v?.componentNaam ?? sc.herkend?.componentNaam ?? (soort === "image" && bron ? bron.split("/").at(-1)! : sc.naam));
  return {
    naam,
    weergavenaam: naam ? naam[0]!.toUpperCase() + naam.slice(1).replace(/-/g, " ") : "",
    laag: "",
    herkenning: { soort, patroon: v?.patroon ?? (bron ? `^${escape(bron)}$` : "") },
    doel: true,
  };
}

/** Whether a pattern is a valid regular expression. */
export function geldigPatroon(patroon: string): boolean {
  if (!patroon.trim()) return false;
  try {
    new RegExp(patroon);
    return true;
  } catch {
    return false;
  }
}

export type Bevinding = { veld: keyof Opname | "herkenning.patroon"; melding: string; ernst: "fout" | "let op" };

/**
 * What stands in the way of taking this in (ernst "fout"), and what is worth a
 * look but allowed ("let op": the pattern does not match this very workload).
 */
export function controleerOpname(o: Opname, ctx: { bestaandeNamen: string[]; lagen: string[]; scan?: ScanComponent }): Bevinding[] {
  const uit: Bevinding[] = [];
  const naam = o.naam.trim();
  if (!naam) uit.push({ veld: "naam", melding: "Geef een naam.", ernst: "fout" });
  else if (alsNaam(naam) !== naam) uit.push({ veld: "naam", melding: "Alleen kleine letters, cijfers en streepjes.", ernst: "fout" });
  else if (ctx.bestaandeNamen.some((b) => b.toLowerCase() === naam.toLowerCase()))
    uit.push({ veld: "naam", melding: `Er is al een component "${naam}" in het register.`, ernst: "fout" });
  if (!o.weergavenaam.trim()) uit.push({ veld: "weergavenaam", melding: "Geef een weergavenaam.", ernst: "fout" });
  if (!ctx.lagen.includes(o.laag)) uit.push({ veld: "laag", melding: "Kies een laag.", ernst: "fout" });
  if (!geldigPatroon(o.herkenning.patroon)) {
    uit.push({ veld: "herkenning.patroon", melding: "Het patroon is geen geldige reguliere expressie.", ernst: "fout" });
  } else if (ctx.scan) {
    const tegen = o.herkenning.soort === "image" ? (ctx.scan.image ? imageZonderTag(ctx.scan.image) : undefined) : ctx.scan.chart;
    if (tegen !== undefined && !new RegExp(o.herkenning.patroon).test(tegen))
      uit.push({ veld: "herkenning.patroon", melding: `Het patroon herkent ${tegen} niet.`, ernst: "let op" });
  }
  return uit;
}

export const isOpneembaar = (b: Bevinding[]) => !b.some((x) => x.ernst === "fout");

/** The layers a Component may have (the enum of ComponentLaag, registerschema 8). */
export const LAGEN = ["1-2 gegevensbronnen", "3 verbinding", "4-5 proces"] as const;

/** What a registration of a new Component may contain (the site's whitelist; the register filters the account as well). */
export const COMPONENT_TOEGESTAAN: ReadonlySet<string> = new Set(["component", "componentnaam", "componentlaag", "componentherkenning"]);

const NIEUW = "$nieuw.component";

/**
 * A new Component as one registration (BACKEND 25-11-2026, checked against
 * registerschema 8): the entity with its aanvang (a date; the engine makes the
 * Component_Aanvang), name, layer and recognition rule, tied together by the
 * placeholder id. Check first with controleerOpname: the register enforces only
 * the unique name.
 */
export function planComponent(o: Opname, vandaag: string): Registratie {
  const naam = o.naam.trim();
  return {
    opmerking: `Component ${naam} opgenomen uit de scan`,
    registratietype: "registratie",
    wijzigingen: [
      { opvoer: { component: { id: NIEUW, aanvang: vandaag } } },
      { opvoer: { componentnaam: { component_id: NIEUW, naam, weergavenaam: o.weergavenaam.trim() } } },
      { opvoer: { componentlaag: { component_id: NIEUW, laag: o.laag } } },
      { opvoer: { componentherkenning: { component_id: NIEUW, soort: o.herkenning.soort, patroon: o.herkenning.patroon } } },
    ],
  };
}
