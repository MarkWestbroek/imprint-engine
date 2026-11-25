import { readFile } from "node:fs/promises";
import type { Inrichting } from "./inrichting";
import { own } from "./inrichting";
import { relation } from "./register";

/**
 * The scan of an environment (Fundament docs/inrichtingstool-als-plugin.md §3):
 * what runs in a namespace, as the plugin sees it in the cluster. The site
 * never talks to the Kubernetes API itself; it asks the plugin's scan
 * endpoint (SCAN_URL, Bearer SCAN_TOKEN). Until that endpoint exists, an
 * example scan is built from what the register knows, plainly labelled.
 * A scan is an observation: nothing is written.
 */

export type ScanComponent = {
  namespace: string;
  naam: string;
  bron: "deployment" | "statefulset";
  /** From the label helm.sh/chart (the plugin reads no Helm release Secrets). */
  viaHelm?: boolean;
  chart?: string;
  chartVersie?: string;
  image?: string;
  /** appVersion, else the image tag. */
  versie?: string;
  /** From the HTTPRoute (https://host) when there is one. */
  adres?: string;
  /** The service DNS inside the cluster. */
  adresIntern?: string;
  /** Helper workloads (worker, beat, nginx, redis) folded into this component. */
  onderdelen?: string[];
  /** The register's component (its `naam` in /full/componenten), or null when not recognised. */
  herkend: { componentNaam: string } | null;
  bereikbaar: boolean | null;
};

export type Scan = {
  gescandOp: string;
  /** The namespaces scanned; ["*"] = all. An omgeving can span several (lab: zgw, gzac, iam). */
  namespaces: string[];
  componenten: ScanComponent[];
  /** True: not a live scan (a recorded one, or built from the register). */
  voorbeeld: boolean;
  /** A recorded scan (SCAN_OPNAME): when it was made. */
  opgenomen?: string;
  meldingen?: string[];
  /** Where the plugin took its recognition rules from (v0.8.0): the register's component_herkenningen, or its built-in table. */
  herkenningUit?: "register" | "ingebouwd";
  fout?: string;
};

export const ALLE = "*";
export type Namespace = { naam: string; project?: string; fundamentNaam?: string };

function scanConfig(): { url: string; token?: string } | null {
  const url = process.env.SCAN_URL?.trim().replace(/\/+$/, "");
  return url ? { url, token: process.env.SCAN_TOKEN?.trim() || undefined } : null;
}

type Opname = { gescandOp?: string; namespaces?: (string | Namespace)[]; componenten?: ScanComponent[]; meldingen?: string[]; herkenningUit?: Scan["herkenningUit"] };

/**
 * A recorded scan (the plugin's output saved as JSON, path in SCAN_OPNAME):
 * real data for a demo while the endpoint is not on the cluster yet. It holds
 * the lab's hostnames, so it lives in the cluster or on disk, never in git.
 */
async function opname(): Promise<Opname | null> {
  const pad = process.env.SCAN_OPNAME?.trim();
  if (!pad) return null;
  try {
    return JSON.parse(await readFile(pad, "utf8")) as Opname;
  } catch {
    return null;
  }
}

async function vraag<T>(pad: string): Promise<T> {
  const cfg = scanConfig()!;
  const res = await fetch(`${cfg.url}${pad}`, {
    headers: cfg.token ? { authorization: `Bearer ${cfg.token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`De scan antwoordt ${res.status}.`);
  return (await res.json()) as T;
}

/** The namespaces to choose from: the plugin's list, else (example) the omgevingen in the register. */
export async function namespaces(i: Inrichting): Promise<{ namen: Namespace[]; voorbeeld: boolean; opgenomen?: string; fout?: string }> {
  let fout: string | undefined;
  if (scanConfig()) {
    try {
      const rows = await vraag<Namespace[]>("/namespaces");
      return { namen: rows.filter((r) => r.naam), voorbeeld: false };
    } catch (e) {
      fout = foutTekst(e);
    }
  }
  // Fallback: the recorded scan, else the omgevingen in the register; both labelled as an example.
  const o = await opname();
  if (o) return { namen: (o.namespaces ?? []).map((n) => (typeof n === "string" ? { naam: n } : n)), voorbeeld: true, opgenomen: o.gescandOp, fout };
  const namen = await Promise.all((await i.list("omgevingen").catch(() => [])).map((o) => i.title("omgevingen", o)));
  return { namen: [...new Set(namen)].sort().map((naam) => ({ naam })), voorbeeld: true, fout };
}

const foutTekst = (e: unknown) =>
  `De live scan van de plugin antwoordt niet (${e instanceof Error ? e.message : "onbereikbaar"}); hieronder wat er zonder kan.`;

/** Scan one or more namespaces (["*"] = all). */
export async function scan(i: Inrichting, ns: string[]): Promise<Scan> {
  const gescandOp = new Date().toISOString();
  const namespaces = ns.includes(ALLE) || !ns.length ? [ALLE] : ns;
  let fout: string | undefined;
  if (scanConfig()) {
    try {
      const q = namespaces.map((n) => `namespace=${encodeURIComponent(n)}`).join("&");
      const r = await vraag<{ gescandOp?: string; componenten?: ScanComponent[] }>(`/scan?${q}`);
      return { gescandOp: r.gescandOp ?? gescandOp, namespaces, componenten: r.componenten ?? [], voorbeeld: false, meldingen: (r as Opname).meldingen, herkenningUit: (r as Opname).herkenningUit };
    } catch (e) {
      fout = foutTekst(e);
    }
  }
  const o = await opname();
  if (o) {
    const alle = namespaces.includes(ALLE);
    return {
      gescandOp: o.gescandOp ?? gescandOp,
      namespaces,
      componenten: (o.componenten ?? []).filter((c) => alle || namespaces.includes(c.namespace)),
      voorbeeld: true,
      opgenomen: o.gescandOp,
      meldingen: o.meldingen,
      fout,
    };
  }
  return { ...(await voorbeeldScan(i, namespaces, gescandOp)), fout };
}

/** The example: per omgeving (as namespace) the component versions the register says run there, plus two things a scan would not recognise. */
export async function voorbeeldScan(i: Inrichting, namespaces: string[], gescandOp = new Date().toISOString()): Promise<Scan> {
  const componenten: ScanComponent[] = [];
  for (const o of await i.list("omgevingen").catch(() => [])) {
    const ns = await i.title("omgevingen", o);
    if (!namespaces.includes(ALLE) && !namespaces.includes(ns)) continue;
    for (const l of relation(o, "omgeving_componentversies", own("omgevingen"))) {
      const cv = await i.byId("component_versies", l.id).catch(() => undefined);
      const c = cv ? await i.componentOfVersie(cv) : undefined;
      const naam = i.componentNaam(c);
      if (!naam) continue;
      const apiRoot = typeof l.velden.apiRoot === "string" ? l.velden.apiRoot : undefined;
      componenten.push({
        namespace: ns,
        naam,
        bron: "deployment",
        viaHelm: true,
        chart: naam,
        versie: i.versienummerVan(cv) || undefined,
        adres: apiRoot,
        onderdelen: ["worker", "nginx"],
        herkend: { componentNaam: naam },
        bereikbaar: null,
      });
    }
    componenten.push({ namespace: ns, naam: "mailpit", bron: "deployment", image: "axllent/mailpit:v1.21", versie: "v1.21", herkend: null, bereikbaar: null });
  }
  return { gescandOp, namespaces, componenten, voorbeeld: true };
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Which register component a scanned one is: the plugin recognises (its own
 * table until the register has recognition rules, §5); as a fallback the name,
 * chart or image name equal to a component's name. Undefined when the register
 * has no such component.
 */
export function herken(sc: ScanComponent, componentNamen: string[]): string | undefined {
  if (sc.herkend?.componentNaam) return componentNamen.includes(sc.herkend.componentNaam) ? sc.herkend.componentNaam : undefined;
  const image = sc.image?.split(":")[0]?.split("/").at(-1);
  const kandidaten = [sc.naam, sc.chart, image].map(norm).filter(Boolean);
  return componentNamen.find((n) => kandidaten.includes(norm(n)));
}
