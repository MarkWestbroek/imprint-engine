import { revalidatePath } from "next/cache";
import { ANONYMOUS, permit, userSubject, type AuthzenSubject } from "@imprint/content-core";
import type { TokenGrant } from "@imprint/content-core/user-store";
import { assetRefUrl, type AdminContext } from "@imprint/runtime-admin";
import { patchHref, patchSlug, patchesHref } from "./href";
import { listPatches } from "./patches";
import { PatchInput, poolAccess, type Patch, type Pool } from "./schemas";

/**
 * The pool's API for the editor (doc/plans/patch-pool.md §8 step 1), a thin
 * policy enforcement point: the token names the user, the schema checks the
 * body, the PDP decides (`create` as yourself, as a proposal — never higher;
 * "own work" keeps a proposal editable by its author). CORS as /api/media.
 *
 *   POST /api/patches            Bearer token with scope patch:propose; body = PatchInput (JSON)
 *                                → 201 { ok, slug, url, pool }
 *   GET  /api/patches?pool=&tag=&slug=
 *                                public: experimenteel, centraal, vraag; with a token also your own proposals
 *                                → 200 { patches: [{ slug, title, pool, tags, author, license, file, syx, takes, requires, derivedFrom, question, answered, url, fileUrl, syxUrl }] }
 */

function corsHeaders(admin: AdminContext, req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !admin.imprint.media.cors.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

const json = (admin: AdminContext, req: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...corsHeaders(admin, req), "Cache-Control": "no-store" } });

async function grantOf(admin: AdminContext, req: Request): Promise<TokenGrant | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return m && admin.imprint.users ? admin.imprint.users.authenticate(m[1]!) : null;
}

const subjectOf = (grant: TokenGrant | null): AuthzenSubject => (grant ? userSubject(grant.user.name, grant.user.role) : ANONYMOUS);

function publicOrigin(req: Request): string {
  const first = (h: string | null) => h?.split(",")[0]?.trim() || null;
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"));
  const own = new URL(req.url);
  const proto = first(req.headers.get("x-forwarded-proto")) ?? own.protocol.replace(":", "");
  return host ? `${proto}://${host}` : own.origin;
}

function wire(req: Request, p: Patch) {
  const abs = (ref: string | undefined) => (ref ? new URL(assetRefUrl(ref) ?? ref, publicOrigin(req)).toString() : undefined);
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    pool: p.pool,
    tags: p.tags,
    author: p.author,
    license: p.license,
    file: p.file,
    syx: p.syx,
    takes: p.takes,
    requires: p.requires,
    derivedFrom: p.derivedFrom,
    question: p.question,
    answered: p.answered,
    publishedAt: p.publishedAt,
    url: new URL(patchHref(p.slug), publicOrigin(req)).toString(),
    fileUrl: abs(p.file),
    syxUrl: abs(p.syx),
  };
}

async function get(admin: AdminContext, req: Request): Promise<Response> {
  const grant = await grantOf(admin, req);
  const q = new URL(req.url).searchParams;
  const pool = q.get("pool");
  // The reader's own view: the guarded store hides what the PDP denies (proposals of others).
  const reader = admin.imprint.storeFor(subjectOf(grant));
  const patches = await listPatches(reader, { pool: pool ? (pool as Pool) : undefined, tag: q.get("tag") ?? undefined });
  const slug = q.get("slug");
  return json(admin, req, { patches: patches.filter((p) => !slug || p.slug === slug).map((p) => wire(req, p)) });
}

async function post(admin: AdminContext, req: Request): Promise<Response> {
  const grant = await grantOf(admin, req);
  if (!grant) return json(admin, req, { error: "Missing or invalid API token" }, 401);
  if (!grant.scopes.includes("patch:propose")) return json(admin, req, { error: 'This token lacks the scope "patch:propose"' }, 403);
  const store = admin.imprint.writableStore;
  if (!store) return json(admin, req, { error: "The pool requires DATABASE_URL" }, 409);
  const body = await req.json().catch(() => null);
  const input = PatchInput.safeParse(body);
  if (!input.success) return json(admin, req, { error: "Invalid patch", issues: input.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
  const { kind, ...rest } = input.data;
  const pool: Pool = kind === "question" ? "vraag" : "voorstel";
  const base = patchSlug(rest.title) || "patch";
  let slug = base;
  for (let n = 2; await store.getItem("patch", slug, "en"); n++) slug = `${base}-${n}`;
  const { user } = grant;
  const resource = { type: "patch", id: slug, properties: { access: poolAccess(pool), author: user.name, proposal: true } };
  if (!(await permit(admin.imprint.pdp, userSubject(user.name, user.role), "create", resource))) {
    return json(admin, req, { error: "This user may not propose patches" }, 403);
  }
  const patch = { ...rest, slug, lang: "en", pool, author: user.name, answered: false, publishedAt: new Date().toISOString().slice(0, 10) };
  try {
    await store.putItem("patch", slug, patch, { lang: "en", by: user.name });
  } catch (err) {
    return json(admin, req, { error: err instanceof Error ? err.message : String(err) }, 422);
  }
  for (const path of [patchesHref(), `${patchesHref()}/lab`, `${patchesHref()}/vragen`, patchHref(slug)]) revalidatePath(path);
  return json(admin, req, { ok: true, slug, pool, url: new URL(patchHref(slug), publicOrigin(req)).toString() }, 201);
}

/** The route handler for `/api/patches` (GET, POST, OPTIONS). */
export async function patchesApi(admin: AdminContext, req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(admin, req) });
  if (req.method === "GET") return get(admin, req);
  if (req.method === "POST") return post(admin, req);
  return json(admin, req, { error: "Method not allowed" }, 405);
}
