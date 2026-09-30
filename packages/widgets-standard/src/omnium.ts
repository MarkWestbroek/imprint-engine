import { sanitizeSvg } from "./svg-sanitize";

/**
 * Client for the Omnium render API (design/opdracht-omnium-render-api.md;
 * contract: bitemporal `docs/RENDER_API.md`). Omnium owns layout, colour and
 * notation; Imprint asks for an SVG, sanitises it and puts it inline.
 *
 * Two ways in:
 *  - model-link: `GET {base}/api/models/{naam}/diagram.svg?versie=&asOf=&…`
 *  - model-code: `POST {base}/api/render/svg` with the model (or its text)
 *
 * The base URL is the site's `OMNIUM_URL` (server env, read per call). Errors
 * come back as problem+json; the widget shows them to the editor.
 */

export type OmniumView = {
  diagram?: string;
  domein?: string;
  /** Comma-separated entity names: a refinement within the diagram/domain. */
  entiteiten?: string;
  richting?: "TB" | "LR";
  velden?: boolean;
  afhankelijkheden?: boolean;
};

export type OmniumSource =
  | { kind: "link"; naam: string; versie?: string; asOf?: string }
  | { kind: "code"; code: string }
  | { kind: "model"; model: unknown };

export type OmniumProblem = {
  status: number;
  detail: string;
  element?: string;
  pad?: string;
  regel?: number;
  kolom?: number;
  /** Offered by Omnium when no (or an unknown) view was chosen. */
  diagrammen?: string[];
  domeinen?: string[];
};

export type OmniumResult = { svg: string } | { problem: OmniumProblem };

export function omniumBaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const base = env.OMNIUM_URL?.trim();
  return base ? base.replace(/\/+$/, "") : undefined;
}

const TIMEOUT_MS = 10_000;

function viewParams(view: OmniumView): Record<string, string | boolean> {
  const p: Record<string, string | boolean> = { theme: "auto" };
  if (view.diagram) p.diagram = view.diagram;
  else if (view.domein) p.domein = view.domein;
  if (view.entiteiten?.trim()) p.entiteiten = view.entiteiten.trim();
  if (view.richting) p.richting = view.richting;
  if (view.velden === false) p.velden = false;
  if (view.afhankelijkheden) p.afhankelijkheden = true;
  return p;
}

/** The request for a source + view; exported for tests. */
export function omniumRequest(base: string, source: OmniumSource, view: OmniumView): { url: string; init: RequestInit } {
  const params = viewParams(view);
  if (source.kind === "link") {
    const q = new URLSearchParams();
    if (source.versie) q.set("versie", source.versie);
    if (source.asOf) q.set("asOf", source.asOf);
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    return { url: `${base}/api/models/${encodeURIComponent(source.naam)}/diagram.svg?${q}`, init: { method: "GET" } };
  }
  const body = { taal: "v3", ...(source.kind === "code" ? { code: source.code } : { model: source.model }), ...params };
  return {
    url: `${base}/api/render/svg`,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  };
}

async function problemFrom(res: Response): Promise<OmniumProblem> {
  const text = await res.text().catch(() => "");
  try {
    const p = JSON.parse(text) as Partial<OmniumProblem> & { title?: string };
    return {
      status: res.status,
      detail: p.detail || p.title || `Omnium answered ${res.status}`,
      element: p.element,
      pad: p.pad,
      regel: p.regel,
      kolom: p.kolom,
      diagrammen: Array.isArray(p.diagrammen) ? p.diagrammen : undefined,
      domeinen: Array.isArray(p.domeinen) ? p.domeinen : undefined,
    };
  } catch {
    return { status: res.status, detail: `Omnium answered ${res.status}` };
  }
}

/** What a model offers to draw (`views.json`), for the studio's pick list. */
export type OmniumViews = { diagrammen: string[]; domeinen: string[]; versie?: string; tijdstip?: string };

export async function fetchOmniumViews(
  base: string,
  naam: string,
  versie?: string,
  asOf?: string
): Promise<OmniumViews | { error: string }> {
  const q = new URLSearchParams();
  if (versie) q.set("versie", versie);
  if (asOf) q.set("asOf", asOf);
  const url = `${base}/api/models/${encodeURIComponent(naam)}/views.json${q.size ? `?${q}` : ""}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return { error: (await problemFrom(res)).detail };
    const v = (await res.json()) as Partial<OmniumViews> & { versie?: unknown };
    return {
      diagrammen: Array.isArray(v.diagrammen) ? v.diagrammen.map(String) : [],
      domeinen: Array.isArray(v.domeinen) ? v.domeinen.map(String) : [],
      versie: v.versie != null ? String(v.versie) : undefined,
      tijdstip: typeof v.tijdstip === "string" ? v.tijdstip : undefined,
    };
  } catch (e) {
    return { error: `Omnium not reachable (${e instanceof Error ? e.message : String(e)})` };
  }
}

/**
 * The same pick list from a V3 model document the editor has at hand; the
 * rule mirrors Omnium's `v3Views` (diagramsvg/selectie.js): diagram names,
 * and domains from `domeinen[]` plus every entity's `domein`.
 */
export function viewsOfModel(model: unknown): OmniumViews {
  const o = (model && typeof model === "object" ? model : {}) as Record<string, unknown>;
  // A Studio export wraps the model in an envelope: { versie, model: {…} }.
  const m = (o.model && typeof o.model === "object" ? o.model : o) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const add = (into: string[], n: unknown) => {
    if (typeof n === "string" && n && !into.includes(n)) into.push(n);
  };
  const diagrammen: string[] = [];
  const domeinen: string[] = [];
  for (const d of list(m.diagrammen)) add(diagrammen, d?.naam);
  for (const d of list(m.domeinen)) add(domeinen, d?.naam);
  for (const e of list(m.entiteiten)) add(domeinen, e?.domein);
  return { diagrammen, domeinen };
}

export async function renderOmniumSvg(base: string, source: OmniumSource, view: OmniumView): Promise<OmniumResult> {
  const { url, init } = omniumRequest(base, source, view);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 600 },
    } as RequestInit);
  } catch (e) {
    return { problem: { status: 0, detail: `Omnium not reachable (${e instanceof Error ? e.message : String(e)})` } };
  }
  if (!res.ok) return { problem: await problemFrom(res) };
  const svg = sanitizeSvg(await res.text());
  if (!svg) return { problem: { status: res.status, detail: "Omnium returned no usable SVG." } };
  return { svg };
}
