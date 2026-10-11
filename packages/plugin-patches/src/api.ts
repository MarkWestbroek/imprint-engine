import { ANONYMOUS, permit, userSubject, type AuthzenSubject } from "@imprint/content-core";
import type { TokenGrant } from "@imprint/content-core/user-store";
import { assetRefUrl, corsHeadersFor, type AdminContext } from "@imprint/runtime-admin";
import { patchHref, patchSlug } from "./href";
import { getPatch, listPatches } from "./patches";
import { touchPatch } from "./revalidate";
import { JUDGED_POOLS, PatchInput, PatchPromote, PatchSchema, PatchUpdate, poolAccess, type Patch, type Pool } from "./schemas";

/**
 * The pool's API for the editor (doc/plans/patch-pool.md §8 step 1), a thin
 * policy enforcement point: the token names the user, the schema checks the
 * body, the PDP decides (`create` as yourself, as a proposal — never higher;
 * "own work" keeps a proposal editable by its author). CORS as /api/media.
 *
 *   POST /api/patches            Bearer token with scope patch:propose; body = PatchInput (JSON)
 *                                → 201 { ok, slug, url, pool }
 *   PATCH /api/patches/<slug>    Bearer token (patch:propose), two bodies:
 *                                { kind: "proposal" | "question", question? } — your own private patch
 *                                (pool `prive`) becomes a proposal or a question → 200 { ok, slug, pool }
 *                                PatchUpdate (content fields) — the author changes their own patch
 *                                → 200 { ok, slug, pool, changed, requeued }
 *   GET  /api/patches?pool=&tag=&slug=
 *                                public: experimenteel, centraal, vraag; with a token also your own proposals
 *                                → 200 { patches: [{ slug, title, pool, tags, author, license, file, syx, front, takes, requires, derivedFrom, question, answered, url, fileUrl, syxUrl, frontUrl }] }
 *
 * What the API deliberately cannot do is set a pool: a script never publishes
 * itself into the central set. Moderation is the admin's (`/admin/patches`),
 * and an update of judged content asks for that judgement again (see `update`).
 */

// The public pools are public: a GET without a token is answered for any
// origin (the editor on localhost, a phone on a LAN address); the listed
// origins may also propose and promote with their token (media/cors.ts).
function corsHeaders(admin: AdminContext, req: Request): Record<string, string> {
  return corsHeadersFor(admin.imprint.media.cors, req, { methods: "GET, POST, PATCH, OPTIONS", headers: "Authorization, Content-Type" });
}

// An explicit charset: JSON is UTF-8 by definition, but some clients (PowerShell 5.1) read it as Latin-1 without one.
const json = (admin: AdminContext, req: Request, body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...corsHeaders(admin, req), "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });

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
    front: p.front,
    takes: p.takes,
    requires: p.requires,
    derivedFrom: p.derivedFrom,
    question: p.question,
    answered: p.answered,
    publishedAt: p.publishedAt,
    url: new URL(patchHref(p.slug), publicOrigin(req)).toString(),
    fileUrl: abs(p.file),
    syxUrl: abs(p.syx),
    frontUrl: abs(p.front),
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
  const pool: Pool = kind === "question" ? "vraag" : kind === "private" ? "prive" : "voorstel";
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
  touchPatch(slug);
  return json(admin, req, { ok: true, slug, pool, url: new URL(patchHref(slug), publicOrigin(req)).toString() }, 201);
}

/** Token, scope and store: what every write through this API needs before it looks at a body. */
async function writer(admin: AdminContext, req: Request): Promise<{ grant: TokenGrant } | Response> {
  const grant = await grantOf(admin, req);
  if (!grant) return json(admin, req, { error: "Missing or invalid API token" }, 401);
  if (!grant.scopes.includes("patch:propose")) return json(admin, req, { error: 'This token lacks the scope "patch:propose"' }, 403);
  if (!admin.imprint.writableStore) return json(admin, req, { error: "The pool requires DATABASE_URL" }, 409);
  return { grant };
}

const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }) => error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

async function promote(admin: AdminContext, req: Request, slug: string, body: unknown): Promise<Response> {
  const allowed = await writer(admin, req);
  if (allowed instanceof Response) return allowed;
  const store = admin.imprint.writableStore!;
  const input = PatchPromote.safeParse(body);
  if (!input.success) return json(admin, req, { error: "Invalid request", issues: issuesOf(input.error) }, 400);
  const { grant } = allowed;
  const { user } = grant;
  const subject = userSubject(user.name, user.role);
  // Read as the token's user: someone else's private patch does not exist for them (404, not 403).
  const patch = await getPatch(admin.imprint.storeFor(subject), slug);
  if (!patch) return json(admin, req, { error: `No patch "${slug}"` }, 404);
  if (patch.pool !== "prive") return json(admin, req, { error: "Only a private patch can be proposed this way" }, 409);
  const resource = { type: "patch", id: slug, properties: { access: "private", author: patch.author, proposal: true } };
  if (!(await permit(admin.imprint.pdp, subject, "update", resource))) return json(admin, req, { error: "Only its author can propose this patch" }, 403);
  const pool: Pool = input.data.kind === "question" ? "vraag" : "voorstel";
  const next = PatchSchema.safeParse({ ...patch, pool, question: input.data.question ?? patch.question, publishedAt: new Date().toISOString().slice(0, 10) });
  if (!next.success) return json(admin, req, { error: "Invalid patch", issues: issuesOf(next.error) }, 400);
  await store.putItem("patch", slug, next.data, { lang: "en", by: user.name });
  touchPatch(slug);
  return json(admin, req, { ok: true, slug, pool });
}

/** The content fields, in the order the schema declares them: one place to add a new one. */
const UPDATABLE = Object.keys(PatchUpdate.shape) as (keyof PatchUpdate)[];

/** The fields this body really changes. Absent (or undefined) is "unchanged", so the API never empties a field by omission. */
function changedFields(patch: Patch, body: PatchUpdate): (keyof PatchUpdate)[] {
  return UPDATABLE.filter((f) => body[f] !== undefined && JSON.stringify(body[f]) !== JSON.stringify(patch[f]));
}

/**
 * The author updates their own patch, on the slug it already has (the decision
 * of 11-10): one patch is one identity, so an update touches neither its URL
 * nor its history — it is a new version, the old ones stay readable.
 *
 * The rule that makes this safe: **a content change sends the patch back to
 * `voorstel`**, also from `centraal`. Otherwise one approval would keep
 * covering content that quietly changed afterwards; this way the moderator
 * judges the content, not the name it once had. A private patch and a question
 * keep their pool — neither is waiting for a place in the set. A body that
 * changes nothing writes nothing, so a seed script may run twice.
 */
async function update(admin: AdminContext, req: Request, slug: string, body: unknown): Promise<Response> {
  const allowed = await writer(admin, req);
  if (allowed instanceof Response) return allowed;
  const store = admin.imprint.writableStore!;
  const input = PatchUpdate.safeParse(body);
  if (!input.success) return json(admin, req, { error: "Invalid patch", issues: issuesOf(input.error) }, 400);
  const { user } = allowed.grant;
  const subject = userSubject(user.name, user.role);
  // Read as the token's user: someone else's private patch does not exist for them (404, not 403).
  const patch = await getPatch(admin.imprint.storeFor(subject), slug);
  if (!patch) return json(admin, req, { error: `No patch "${slug}"` }, 404);
  // The write keeps the patch in the proposal track (it ends up in `voorstel`),
  // so it asks the PDP as a proposal: the author may, anyone else may not.
  const resource = { type: "patch", id: slug, properties: { access: poolAccess(patch.pool), author: patch.author, proposal: true } };
  if (!(await permit(admin.imprint.pdp, subject, "update", resource))) return json(admin, req, { error: "Only its author can update this patch" }, 403);
  if (input.data.derivedFrom === slug) return json(admin, req, { error: "A patch cannot be derived from itself" }, 400);
  // CC0 is a gift, not a loan: it may be given here, never taken back.
  if (patch.license === "CC0" && input.data.license && input.data.license !== "CC0") {
    return json(admin, req, { error: "CC0 cannot be withdrawn: the patch stays CC0" }, 409);
  }
  const changed = changedFields(patch, input.data);
  if (changed.length === 0) return json(admin, req, { ok: true, slug, pool: patch.pool, changed, requeued: false });
  const requeued = JUDGED_POOLS.includes(patch.pool);
  const fields = Object.fromEntries(changed.map((f) => [f, input.data[f]]));
  const next = PatchSchema.safeParse({ ...patch, ...fields, ...(requeued ? { pool: "voorstel" } : {}) });
  if (!next.success) return json(admin, req, { error: "Invalid patch", issues: issuesOf(next.error) }, 400);
  try {
    await store.putItem("patch", slug, next.data, { lang: "en", by: user.name });
  } catch (err) {
    return json(admin, req, { error: err instanceof Error ? err.message : String(err) }, 422);
  }
  touchPatch(slug);
  return json(admin, req, { ok: true, slug, pool: next.data.pool, changed, requeued });
}

/** `question` carries a promotion's text as well, so it never marks a body as a content update. */
const CONTENT_KEYS = UPDATABLE.filter((f) => f !== "question");

/** The route handler for `/api/patches/<slug>` (PATCH, OPTIONS). */
export async function patchesApiItem(admin: AdminContext, req: Request, slug: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(admin, req) });
  if (req.method !== "PATCH") return json(admin, req, { error: "Method not allowed" }, 405);
  // One method, two bodies: `kind` promotes a private patch, content fields
  // update one. Both at once is ambiguous (which pool wins?), so say so.
  const body = await req.json().catch(() => null);
  const keys = body && typeof body === "object" ? Object.keys(body) : [];
  if (!keys.includes("kind")) return update(admin, req, slug, body);
  const content = keys.filter((k) => (CONTENT_KEYS as string[]).includes(k));
  if (content.length > 0) {
    return json(admin, req, { error: `Promote with "kind" or update content fields, not both in one call (${content.join(", ")})` }, 400);
  }
  return promote(admin, req, slug, body);
}

/** The route handler for `/api/patches` (GET, POST, OPTIONS). */
export async function patchesApi(admin: AdminContext, req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(admin, req) });
  if (req.method === "GET") return get(admin, req);
  if (req.method === "POST") return post(admin, req);
  return json(admin, req, { error: "Method not allowed" }, 405);
}
