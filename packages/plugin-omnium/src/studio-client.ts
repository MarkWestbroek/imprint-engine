import type { Elementen, Operatie, StudioElement } from "./studio-formulier";

/**
 * The Omnium Studio, as the werkplaats needs it (Fase B, laag 2): projects,
 * their operation log, branching, and writing ops — with the writer account
 * `omnium-schrijver` (Secret tnt-cg--inrichting/omnium-schrijver, key
 * OMNIUM_SCHRIJF_TOKEN; agreed with FUNDAMENT/BACKEND 10-11-2026). Server only:
 * the token never reaches the browser, a log or an error message.
 *
 * Reading the form: the server keeps a snapshot (the project blob, valid up to
 * `tot_volgnummer`) and the ops after it, and replays nothing. Until Omnium
 * offers a materialised read (GET …/model/:profiel, asked 10-11), this replays
 * only what can change the elements of `model:formulierdiagram`, and refuses
 * any other op on that store rather than guess (BACKEND 10-11).
 */

export type ProjectMeta = {
  id: string;
  naam: string;
  versie?: number;
  tot_volgnummer?: number;
  laatste_volgnummer?: number;
  herkomst?: { ouderProject: string; basisVolgnummer: number; mapId?: string; afgesplitstOp?: string; gearchiveerd?: boolean } | null;
};
type OpRegel = Operatie & { volgnummer: number };

export class StudioError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly reden?: string,
    readonly laatste?: number,
    /** With reden "branch_bestaat": the open branch that already exists for this parent and map. */
    readonly projectId?: string
  ) {
    super(message);
  }
}

export type StudioConfig = { baseUrl: string; token: string; fetch?: typeof fetch };

/** The writer account from the environment; null when the site may not write (read-only werkplaats). */
export function studioConfigFromEnv(): StudioConfig | null {
  const baseUrl = process.env.OMNIUM_REGISTER_URL;
  const token = process.env.OMNIUM_SCHRIJF_TOKEN;
  return baseUrl && token ? { baseUrl: baseUrl.replace(/\/+$/, ""), token } : null;
}

export class OmniumStudio {
  constructor(private readonly cfg: StudioConfig) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await (this.cfg.fetch ?? fetch)(`${this.cfg.baseUrl}/api/studio${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json", ...(init.headers as Record<string, string>) },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const reden = typeof body.reden === "string" ? body.reden : undefined;
      throw new StudioError(
        reden === "volgnummer_verschoven"
          ? "Iemand anders heeft het formulier net gewijzigd."
          : reden === "namens_niet_toegestaan"
            ? "Het schrijfaccount mag niet namens een gebruiker schrijven (OMNIUM_NAMENS_ACCOUNTS)."
            : res.status === 401 || res.status === 403
              ? "Het schrijfaccount heeft geen toegang tot dit project."
              : `De Studio antwoordt ${res.status}${typeof body.error === "string" ? `: ${body.error}` : ""}.`,
        res.status,
        reden,
        typeof body.laatsteVolgnummer === "number" ? body.laatsteVolgnummer : undefined,
        typeof body.projectId === "string" ? body.projectId : undefined
      );
    }
    return body as T;
  }

  projecten = () => this.call<ProjectMeta[]>("/projecten");
  project = (id: string) => this.call<ProjectMeta & { inhoud: Record<string, unknown> }>(`/projecten/${encodeURIComponent(id)}`);
  ops = (id: string, vanaf: number) =>
    this.call<{ ops: OpRegel[]; laatste: number; meer: boolean; snapshotNodig?: boolean }>(`/projecten/${encodeURIComponent(id)}/ops?vanaf=${vanaf}&limiet=5000`);
  /** The materialised profile (Omnium API, render ≥ 0.4.2): replayed server-side; 502 "sidecar" until the renderer can. */
  model = (id: string, profiel: string) =>
    this.call<{ elements?: Elementen; diagrams?: Record<string, Diagram>; laatsteVolgnummer: number; meldingen?: unknown[] }>(
      `/projecten/${encodeURIComponent(id)}/model/${encodeURIComponent(profiel)}`
    );
  afsplitsen = (id: string, body: { naam: string; mapId?: string }) =>
    this.call<ProjectMeta>(`/projecten/${encodeURIComponent(id)}/afsplitsen`, { method: "POST", body: JSON.stringify(body) });
  schrijf = (id: string, body: { clientId: string; ops: Operatie[]; verwachtLaatsteVolgnummer: number; namens?: string }) =>
    this.call<{ van: number; tot: number }>(`/projecten/${encodeURIComponent(id)}/ops`, { method: "POST", body: JSON.stringify(body) });
}

/** The form profile as the werkplaats reads it: its elements, the diagram and where the nodes are, the map, and up to which op. */
export type FdStand = {
  elements: Elementen;
  diagramId?: string;
  posities: Record<string, { x: number; y: number }>;
  plaatsing: Record<string, string>;
  laatste: number;
};

/** Ops on the form store that only move things on a diagram: they leave the elements alone. */
const ALLEEN_DIAGRAM = new Set([
  "removeElementFromDiagram",
  "updateNodePosition",
  "updateNodePositions",
  "updateAnkerPosition",
  "resetAnkerPositions",
  "resetEdgeHandles",
  "updateNodeSize",
  "wisNodeMaten",
  "zetNodeGedaante",
  "zetConnectorGedaante",
  "zetLijnen",
  "zetLijn",
  "verbergConnectorOpDiagram",
  "toonVerborgenConnectoren",
  "toonConnectorOpDiagram",
  "updateDiagramStijl",
  "renameDiagram",
  "patchDiagrammen",
]);

export class OnbekendeOp extends Error {}

type Diagram = { nodes?: { elementId: string; position?: { x: number; y: number } }[] };

/**
 * Replay ops on a form profile (elements, the nodes of its diagrams) and the
 * placement of diagrams in maps — the store semantics of createDiagramStore
 * and patchStructuur, for these ops only.
 */
export function speelNa(stand: { elements: Elementen; diagrams: Record<string, Diagram>; plaatsing: Record<string, string> }, ops: Operatie[], store = "model:formulierdiagram") {
  for (const o of ops) {
    if (o.store === "structuur" && o.op === "patchStructuur") {
      const p = (o.args[0] ?? {}) as { zetPlaatsing?: Record<string, string>; wisPlaatsing?: string[] };
      Object.assign(stand.plaatsing, p.zetPlaatsing ?? {});
      for (const k of p.wisPlaatsing ?? []) delete stand.plaatsing[k];
      continue;
    }
    if (o.store === "structuur" && o.op === "plaatsPerMap") {
      // What the Studio writes (cg-test 10-11): { mapId: [keys] }; "null" = no longer placed in a map.
      for (const [mapId, keys] of Object.entries((o.args[0] ?? {}) as Record<string, string[]>))
        for (const k of Array.isArray(keys) ? keys : []) {
          if (mapId === "null") delete stand.plaatsing[k];
          else stand.plaatsing[k] = mapId;
        }
      continue;
    }
    if (o.store !== store) continue; // other profiles and stores cannot touch these elements
    const a = o.args as unknown[];
    switch (o.op) {
      case "patchElementen": {
        const { zet = {}, wis = [] } = (a[0] ?? {}) as { zet?: Elementen; wis?: string[] };
        Object.assign(stand.elements, structuredClone(zet));
        for (const id of wis) delete stand.elements[id];
        break;
      }
      case "addElement": {
        const el = a[0] as StudioElement | undefined;
        if (el?.id) stand.elements[el.id] = structuredClone(el);
        break;
      }
      case "updateElement":
      case "updateElementen": {
        const patches = o.op === "updateElement" ? { [a[0] as string]: a[1] } : ((a[0] ?? {}) as Record<string, unknown>);
        for (const [id, patch] of Object.entries(patches)) {
          const el = stand.elements[id];
          if (!el || !patch) continue;
          const { data, compartimenten, ...top } = patch as Partial<StudioElement>;
          stand.elements[id] = { ...el, ...top, ...(compartimenten !== undefined ? { compartimenten } : {}), data: data !== undefined ? { ...el.data, ...data } : el.data };
        }
        break;
      }
      case "deleteElement": {
        const id = a[0] as string;
        if (!stand.elements[id]) break;
        const weg = new Set([id, ...Object.values(stand.elements).filter((e) => e.source === id || e.target === id).map((e) => e.id)]);
        for (const k of weg) delete stand.elements[k];
        for (const d of Object.values(stand.diagrams)) d.nodes = (d.nodes ?? []).filter((n) => !weg.has(n.elementId));
        break;
      }
      case "clear":
        stand.elements = {};
        stand.diagrams = {};
        break;
      case "addElementToDiagram": {
        const [diagramId, elementId, position] = a as [string, string, { x: number; y: number } | undefined];
        const d = (stand.diagrams[diagramId] ??= { nodes: [] });
        if (!(d.nodes ?? []).some((n) => n.elementId === elementId)) (d.nodes ??= []).push({ elementId, position });
        break;
      }
      case "addDiagram":
      case "deleteDiagram":
      case "zetDiagram":
        break; // diagrams themselves; the nodes we need come from addElementToDiagram
      default:
        if (ALLEEN_DIAGRAM.has(o.op)) break;
        throw new OnbekendeOp(`De Studio-operatie “${o.op}” kan de werkplaats niet naspelen; open het formulier in de Studio.`);
    }
  }
}

/** The form's diagram (the one holding the formulier root) and its node positions. */
function fdStand(elements: Elementen, diagrams: Record<string, Diagram>, plaatsing: Record<string, string>, laatste: number): FdStand {
  const root = Object.values(elements).find((e) => e.elementType === "formulier");
  const diagramId = Object.entries(diagrams).find(([, d]) => (d.nodes ?? []).some((n) => n.elementId === root?.id))?.[0];
  const posities: FdStand["posities"] = {};
  for (const n of (diagramId && diagrams[diagramId]?.nodes) || []) if (n.position) posities[n.elementId] = n.position;
  return { elements, diagramId, posities, plaatsing, laatste };
}

/**
 * The form profile of a project now. First the materialised read (the API
 * replays the log itself); the map placement comes from the blob's structuur.
 * When that endpoint is not there yet (404, 502 "sidecar"), or the form's map
 * is not in the blob's placement, replay here: the blob, then the ops after it.
 */
export async function leesFd(studio: OmniumStudio, projectId: string): Promise<FdStand> {
  try {
    const [m, p] = await Promise.all([studio.model(projectId, "formulierdiagram"), studio.project(projectId)]);
    const plaatsing = { ...(((p.inhoud?.structuur ?? {}) as { plaatsing?: Record<string, string> }).plaatsing ?? {}) };
    // The blob's placement can lag behind: replay only the structure ops after it (BACKEND 10-11).
    if (await structuurNa(studio, projectId, p.tot_volgnummer ?? 0, m.laatsteVolgnummer, plaatsing)) {
      return fdStand(m.elements ?? {}, m.diagrams ?? {}, plaatsing, m.laatsteVolgnummer);
    }
  } catch (e) {
    if (!(e instanceof StudioError) || (e.status !== 404 && e.status !== 501 && e.status !== 502 && e.status !== 503)) throw e;
  }
  return naspelen(studio, projectId);
}

/** The placement ops (`patchStructuur`) after the blob, up to `tot`; false when the log was compacted meanwhile. */
async function structuurNa(studio: OmniumStudio, projectId: string, vanaf: number, tot: number, plaatsing: Record<string, string>): Promise<boolean> {
  while (vanaf < tot) {
    const page = await studio.ops(projectId, vanaf);
    if (page.snapshotNodig) return false;
    const binnen = page.ops.filter((o) => o.volgnummer <= tot);
    speelNa({ elements: {}, diagrams: {}, plaatsing }, binnen.filter((o) => o.store === "structuur"));
    if (!page.meer || !page.ops.length) break;
    vanaf = page.ops.at(-1)!.volgnummer;
  }
  return true;
}

async function naspelen(studio: OmniumStudio, projectId: string): Promise<FdStand> {
  for (let poging = 0; poging < 2; poging++) {
    const p = await studio.project(projectId);
    const profiel = ((p.inhoud?.profielen as Record<string, unknown>) ?? {}).formulierdiagram as { elements?: Elementen; diagrams?: Record<string, Diagram> } | undefined;
    const structuur = (p.inhoud?.structuur ?? {}) as { plaatsing?: Record<string, string> };
    const stand = {
      elements: structuredClone(profiel?.elements ?? {}),
      diagrams: structuredClone(profiel?.diagrams ?? {}),
      plaatsing: { ...(structuur.plaatsing ?? {}) },
    };
    let vanaf = p.tot_volgnummer ?? 0;
    let laatste = vanaf;
    let opnieuw = false;
    for (;;) {
      const page = await studio.ops(projectId, vanaf);
      if (page.snapshotNodig) {
        opnieuw = true;
        break;
      }
      speelNa(stand, page.ops);
      laatste = page.laatste ?? laatste;
      if (!page.meer || !page.ops.length) break;
      vanaf = page.ops.at(-1)!.volgnummer;
    }
    if (opnieuw) continue;
    return fdStand(stand.elements, stand.diagrams, stand.plaatsing, laatste);
  }
  throw new StudioError("Het operatielog van het project werd tijdens het lezen opgeruimd; probeer het opnieuw.");
}
