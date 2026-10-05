import { AssetRecordSchema, permitted, userSubject, type AssetRecord } from "@imprint/content-core";
import type { TokenGrant, TokenScope } from "@imprint/content-core/user-store";
import type { AdminContext } from "../admin-context";
import { displayUrl } from "../media/access";
import { corsHeadersFor } from "../media/cors";
import { checkUpload, UploadError } from "../media/process";
import { IngestRefused, ingestFiles, normalizeFolder, normalizeGroup, normalizeTag, readUploadForm, replaceAssetFile } from "./media";

/**
 * The external media API (design/beeldbibliotheek.md §12.4): `/api/media` for
 * clients outside the admin — first the MusicBrain patch editor. A thin layer
 * on the upload core: authentication by a personal API token (`Bearer`),
 * limited to the token's scopes and, as always, to what the PDP allows the
 * token's user. Other origins may call it when the site lists them in
 * `media.cors` (`imprint.config.ts`); no cookies are involved (the token is
 * the credential), so the admin session is never exposed cross-origin.
 *
 *   POST /api/media   multipart: file[], folder, tags[], group?, exif?
 *                     → 201 { assets: [{ slug, kind, url, group? }] }
 *   GET  /api/media?folder=&tag=&group=
 *                     → 200 { assets: [{ slug, kind, url, title, folder, tags, group, mime, size, created, updated }] }
 *   PUT  /api/media/<slug>   multipart: file (one) — replaces that asset's file
 *                     → 200 { slug, kind, url, group }   (a new version; the old one stays in History)
 *
 * Errors: 401 no/invalid token, 403 token lacks the scope or its user the
 * right, 413 a file too large, 415 an unsupported file, 400 a bad request.
 * An upload is all-or-nothing: every file is checked before any is stored,
 * so a recording never lands half.
 */

// One policy for the three public routes (media/cors.ts): listed origins get
// the full offer, every origin may read without a token.
function corsHeaders(admin: AdminContext, req: Request): Record<string, string> {
  return corsHeadersFor(admin.imprint.media.cors, req, { methods: "GET, POST, PUT, OPTIONS", headers: "Authorization, Content-Type" });
}

function json(admin: AdminContext, req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...corsHeaders(admin, req), "Cache-Control": "no-store" } });
}

async function grantFor(admin: AdminContext, req: Request, scope: TokenScope): Promise<TokenGrant | Response> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  const grant = m && admin.imprint.users ? await admin.imprint.users.authenticate(m[1]) : null;
  if (!grant) return json(admin, req, { error: "Missing or invalid API token" }, 401);
  if (!grant.scopes.includes(scope)) return json(admin, req, { error: `This token lacks the scope "${scope}"` }, 403);
  return grant;
}

/**
 * The origin the client used. Behind a proxy (Caddy on the VPS) `req.url`
 * carries the server's own listen address (http://0.0.0.0:3000), so the
 * forwarded headers come first, then Host, then `req.url`.
 */
export function publicOrigin(req: Request): string {
  const first = (h: string | null) => h?.split(",")[0]?.trim() || null;
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"));
  const own = new URL(req.url);
  const proto = first(req.headers.get("x-forwarded-proto")) ?? own.protocol.replace(":", "");
  return host ? `${proto}://${host}` : own.origin;
}

/** Absolute, so a client on another origin can use it as is. */
const absolute = (req: Request, url: string) => new URL(url, publicOrigin(req)).toString();

async function post(admin: AdminContext, req: Request): Promise<Response> {
  const grant = await grantFor(admin, req, "media:upload");
  if (grant instanceof Response) return grant;
  const upload = await readUploadForm(req);
  if (!upload) return json(admin, req, { error: "Expected a multipart upload" }, 400);
  if (upload.files.length === 0) return json(admin, req, { error: "No files (field file[])" }, 400);

  // All or nothing: check every file before storing any.
  for (const file of upload.files) {
    try {
      checkUpload(file.bytes, admin.imprint.media.maxBytes);
    } catch (err) {
      const status = err instanceof UploadError ? err.status : 400;
      return json(admin, req, { error: `${file.name}: ${err instanceof Error ? err.message : String(err)}`, file: file.name }, status);
    }
  }

  const { user } = grant;
  try {
    const results = await ingestFiles(admin, userSubject(user.name, user.role), upload.files, { ...upload.opts, by: user.name });
    const failed = results.find((r) => !r.ok);
    if (failed) {
      // Only reachable for a file that passed the check but could not be processed (e.g. a corrupt image).
      return json(admin, req, { error: `${failed.name}: ${failed.error}`, results }, failed.status && failed.status < 500 ? failed.status : 422);
    }
    return json(admin, req, { assets: results.map((r) => ({ slug: r.slug, kind: r.kind, url: absolute(req, r.url!), group: r.group })) }, 201);
  } catch (err) {
    if (err instanceof IngestRefused) return json(admin, req, { error: err.message }, err.status);
    throw err;
  }
}

async function get(admin: AdminContext, req: Request): Promise<Response> {
  const grant = await grantFor(admin, req, "media:read");
  if (grant instanceof Response) return grant;
  const store = admin.imprint.writableStore;
  if (!store) return json(admin, req, { error: "The media library requires DATABASE_URL" }, 409);

  const q = new URL(req.url).searchParams;
  const folder = q.has("folder") ? normalizeFolder(q.get("folder") ?? "") : null;
  const tag = q.get("tag") ? normalizeTag(q.get("tag")!) : null;
  const group = q.get("group") ? normalizeGroup(q.get("group")!) : null;

  const all = (await store.listItems("asset")).flatMap((r) => {
    const parsed = AssetRecordSchema.safeParse(r.data);
    return parsed.success ? [{ ...parsed.data, updated: r.txFrom.toISOString() }] : [];
  });
  const matching = all.filter(
    (a) => (folder === null || a.folder === folder) && (!tag || a.tags.includes(tag)) && (!group || a.group === group)
  );
  const subject = userSubject(grant.user.name, grant.user.role);
  const visible = await permitted<AssetRecord & { updated: string }>(admin.imprint.pdp, subject, "asset", matching, (a) => a.slug);
  return json(admin, req, {
    assets: visible.map((a) => ({
      slug: a.slug,
      kind: a.file.kind,
      url: absolute(req, a.file.kind === "image" ? displayUrl(a) : a.file.original),
      title: a.title,
      folder: a.folder,
      tags: a.tags,
      group: a.group,
      mime: a.file.mime,
      size: a.file.size,
      // Older assets carry no `created`: their current version's time stands in.
      created: a.created ?? a.updated,
      updated: a.updated,
    })),
  });
}

async function put(admin: AdminContext, req: Request, slug: string): Promise<Response> {
  const grant = await grantFor(admin, req, "media:upload");
  if (grant instanceof Response) return grant;
  const upload = await readUploadForm(req);
  if (!upload || upload.files.length !== 1) return json(admin, req, { error: "Expected one file (field file)" }, 400);
  const { user } = grant;
  try {
    const r = await replaceAssetFile(admin, userSubject(user.name, user.role), slug, upload.files[0], { by: user.name });
    if (!r.ok) return json(admin, req, { error: r.error }, r.status ?? 400);
    return json(admin, req, { slug: r.slug, kind: r.kind, url: absolute(req, r.url!), group: r.group });
  } catch (err) {
    if (err instanceof IngestRefused) return json(admin, req, { error: err.message }, err.status);
    throw err;
  }
}

/** The route handler for `/api/media/<slug>` (PUT and the CORS preflight). */
export async function mediaApiItem(admin: AdminContext, req: Request, slug: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(admin, req) });
  if (req.method === "PUT") return put(admin, req, slug);
  return json(admin, req, { error: "Method not allowed" }, 405);
}

/** The route handler for `/api/media` (GET, POST and the CORS preflight). */
export async function mediaApi(admin: AdminContext, req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(admin, req) });
  if (req.method === "POST") return post(admin, req);
  if (req.method === "GET") return get(admin, req);
  return json(admin, req, { error: "Method not allowed" }, 405);
}
