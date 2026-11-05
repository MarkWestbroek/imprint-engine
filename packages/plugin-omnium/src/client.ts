import type { FullRecord } from "./register";

/**
 * Read-only client for the Omnium register (design/omnium-inrichting.md §3.1).
 * Server-side only: the token never reaches the browser.
 *
 *  - `GET /full/<pad>` pages with `page`/`size` and says `has_more`; the list
 *    sits under the type's plural, which may contain a space ("lijst
 *    definities") — we take the one array in the envelope.
 *  - Time travel: `peiltijdstip` (formal, RFC3339) and `geldigOp` (material,
 *    a date) go along on every read.
 *  - Errors are `{error}` (400/401/403/500) or `{message}` (404); problem+json
 *    on `/api/volgorde`. All become an `OmniumRegisterError` with the status.
 *  - The flat route's `filter.` only reaches id columns and is an ILIKE, so
 *    keys are matched in the client (inrichting.ts), never through a filter.
 */

export type ReadMoment = { peiltijdstip?: string; geldigOp?: string };

export type RegisterConfig = {
  baseUrl: string;
  /** A personal token of a reader (`omt_…`); absent = anonymous (definitions only). */
  token?: string;
  fetch?: typeof fetch;
};

export class OmniumRegisterError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly path: string
  ) {
    super(message);
    this.name = "OmniumRegisterError";
  }
}

/** The register from the site's env; null when none is configured. */
export function registerConfigFromEnv(env: Record<string, string | undefined> = process.env): RegisterConfig | null {
  const baseUrl = env.OMNIUM_REGISTER_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  return { baseUrl, token: env.OMNIUM_REGISTER_TOKEN?.trim() || undefined };
}

const PAGE_SIZE = 500;
const MAX_PAGES = 40;
const TIMEOUT_MS = 10_000;

export class OmniumRegister {
  private readonly fetcher: typeof fetch;
  private readonly base: string;

  constructor(private readonly config: RegisterConfig) {
    this.fetcher = config.fetch ?? fetch;
    this.base = config.baseUrl.replace(/\/+$/, "");
  }

  /** Every record of a type, all pages. */
  async list(pad: string, at: ReadMoment = {}): Promise<FullRecord[]> {
    const out: FullRecord[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await this.get(`/full/${pad}`, { ...moment(at), page: String(page), size: String(PAGE_SIZE) });
      out.push(...collection(body, `/full/${pad}`));
      if (!(body as { has_more?: boolean }).has_more) return out;
    }
    throw new OmniumRegisterError(500, `more than ${MAX_PAGES * PAGE_SIZE} records`, `/full/${pad}`);
  }

  /** One record; null when the register says 404 (also: does not exist on `geldigOp`). */
  async one(pad: string, id: number, at: ReadMoment = {}): Promise<FullRecord | null> {
    try {
      return (await this.get(`/full/${pad}/${id}`, moment(at))) as FullRecord;
    } catch (err) {
      if (err instanceof OmniumRegisterError && err.status === 404) return null;
      throw err;
    }
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    let res: Response;
    try {
      res = await this.fetcher(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      throw new OmniumRegisterError(503, `register unreachable (${err instanceof Error ? err.message : String(err)})`, path);
    }
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new OmniumRegisterError(res.ok ? 502 : res.status, `no JSON from the register (${res.status})`, path);
    }
    if (!res.ok) throw new OmniumRegisterError(res.status, errorText(body) ?? `HTTP ${res.status}`, path);
    return body;
  }
}

function moment(at: ReadMoment): Record<string, string> {
  const p: Record<string, string> = {};
  if (at.peiltijdstip) p.peiltijdstip = at.peiltijdstip;
  if (at.geldigOp) p.geldigOp = at.geldigOp;
  return p;
}

/** The envelope's one array: `{ "<meervoud>": [...], page, size, has_more, total_count }`. */
function collection(body: unknown, path: string): FullRecord[] {
  if (!body || typeof body !== "object") throw new OmniumRegisterError(502, "unexpected answer", path);
  const arrays = Object.values(body as Record<string, unknown>).filter(Array.isArray);
  if (arrays.length !== 1) throw new OmniumRegisterError(502, `expected one list in the answer, found ${arrays.length}`, path);
  return arrays[0] as FullRecord[];
}

function errorText(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  for (const k of ["error", "message", "detail", "title"]) if (typeof b[k] === "string") return b[k] as string;
  return undefined;
}

/** What the site shows for a failed read; a 401 must not look like an empty register. */
export function registerProblem(err: unknown): string {
  if (!(err instanceof OmniumRegisterError)) return "Het register gaf een onverwachte fout.";
  if (err.status === 401) return "Het register weigert het leestoken: verlopen, ingetrokken of niet ingesteld (OMNIUM_REGISTER_TOKEN).";
  if (err.status === 403) return "Het leesaccount mag dit deel van het register niet lezen.";
  if (err.status === 503) return `Het register is niet bereikbaar: ${err.message}`;
  return `Het register gaf een fout (${err.status}): ${err.message}`;
}
