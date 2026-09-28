import { revalidatePath } from "next/cache";
import {
  AssetMetaSchema,
  AssetRecordSchema,
  contentResource,
  ExifPolicy,
  permit,
  TaglistSchema,
  userSubject,
  type AssetRecord,
  type AuthzenSubject,
} from "@imprint/content-core";
import type { AdminContext } from "../admin-context";
import type { ActionResult } from "../admin/types";
import { displayUrl, fileAccess, thumbUrl } from "../media/access";
import { processUpload, slugFromFilename, uniqueSlug, UploadError } from "../media/process";

/**
 * The media library's server side (design/beeldbibliotheek.md).
 *
 * - `ingestFiles` is the one upload core (§12.1): it knows no HTTP and no
 *   login method, only a `subject` the PDP decides on. The admin route, the
 *   external API (step 4) and scripts all go through it.
 * - `uploadAssets` / `serveAsset` are route handlers a site mounts with a
 *   one-line route file; the actions are wrapped in the site's "use server"
 *   module.
 *
 * Files of a library asset live under `library/<slug>/` in the AssetStore.
 * Serving decides per file with the asset's record (§7: access per format;
 * the original of an image is never public).
 */

const LIBRARY = "library/";

/** Flush the public site's cache after a change; outside a Next request (scripts, tests) there is none. */
function revalidateSite(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    // no Next.js request context
  }
}

/** "Externe  Afbeeldingen//2026/" → "externe afbeeldingen/2026". */
export function normalizeFolder(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split("/")
    .map((s) => s.replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("/");
}

/** "Onderwerp/Portret " → "onderwerp/portret"; a tag keeps at most one list prefix. */
export function normalizeTag(value: string): string {
  const parts = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split("/")
    .map((s) => s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return parts.length > 1 ? `${parts[0]}/${parts.slice(1).join("-")}` : (parts[0] ?? "");
}

/** A group id as given ("MMB take 2026-09-28 12:00") → a slug. */
export function normalizeGroup(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const titleFromFilename = (name: string) => name.replace(/\.[^.]*$/, "").replace(/[-_]+/g, " ").trim();

export type IngestFile = { name: string; bytes: Uint8Array };
export type IngestOptions = { folder?: string; tags?: string[]; group?: string; exif?: ExifPolicy; by?: string };
export type IngestResult = {
  name: string;
  ok: boolean;
  slug?: string;
  kind?: string;
  /** What a page shows by default: the original for non-images, else the original too (variants are in the record). */
  url?: string;
  group?: string;
  error?: string;
  /** For an API answer: 413 too large, 415 unsupported, 400 bad, 403 not allowed. */
  status?: number;
};

export class IngestRefused extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 409
  ) {
    super(message);
  }
}

/**
 * Put files in the library. Refuses the whole call (IngestRefused) when the
 * subject may not create assets or there is no database; otherwise answers
 * per file, so one bad file does not stop the others.
 */
export async function ingestFiles(
  admin: AdminContext,
  subject: AuthzenSubject,
  files: IngestFile[],
  opts: IngestOptions = {}
): Promise<IngestResult[]> {
  const store = admin.imprint.writableStore;
  if (!store) throw new IngestRefused("The media library requires DATABASE_URL", 409);
  if (!(await permit(admin.imprint.pdp, subject, "create", contentResource("asset", "*")))) {
    throw new IngestRefused("Not allowed to add media", 403);
  }

  const folder = normalizeFolder(opts.folder ?? "");
  const tags = [...new Set((opts.tags ?? []).map(normalizeTag).filter(Boolean))];
  const group = opts.group ? normalizeGroup(opts.group) || undefined : undefined;
  const policy = opts.exif ?? "no-location";
  const by = opts.by ?? subject.id;
  const taken = new Set((await store.listItems("asset")).map((r) => r.slug));
  const results: IngestResult[] = [];

  for (const file of files) {
    try {
      const processed = await processUpload(file.bytes, policy, { maxBytes: admin.imprint.media.maxBytes });
      const slug = uniqueSlug(slugFromFilename(file.name), taken);
      const assets = admin.imprint.assets;
      const original = await assets.put(`${LIBRARY}${slug}/original.${processed.ext}`, file.bytes);
      const variants = [];
      for (const v of processed.variants) {
        variants.push({ width: v.width, height: v.height, url: await assets.put(`${LIBRARY}${slug}/w${v.width}.webp`, v.bytes) });
      }
      const data: AssetRecord = AssetRecordSchema.parse({
        slug,
        lang: "en",
        title: titleFromFilename(file.name),
        credit: processed.credit,
        folder,
        tags,
        group,
        file: {
          filename: file.name,
          kind: processed.kind,
          mime: processed.mime,
          size: file.bytes.byteLength,
          width: processed.width,
          height: processed.height,
          original,
          variants,
          exif: policy,
        },
        photo: processed.photo,
        gps: processed.gps,
        audio: processed.audio,
        data: processed.data,
      });
      await store.putItem("asset", slug, data, { lang: "en", by });
      taken.add(slug);
      results.push({ name: file.name, ok: true, slug, kind: processed.kind, url: original, group });
    } catch (err) {
      const status = err instanceof UploadError ? err.status : 500;
      results.push({ name: file.name, ok: false, error: err instanceof Error ? err.message : String(err), status });
    }
  }
  return results;
}

/** Read the multipart fields every upload route shares: file[], folder, tags[], group, exif. */
export async function readUploadForm(req: Request): Promise<{ files: IngestFile[]; opts: IngestOptions } | null> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return null;
  }
  const files: IngestFile[] = [];
  for (const f of [...form.getAll("file"), ...form.getAll("file[]")]) {
    if (f instanceof File) files.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  const tags = [...form.getAll("tags"), ...form.getAll("tags[]")].flatMap((t) => String(t).split(",")).map((t) => t.trim());
  return {
    files,
    opts: {
      folder: String(form.get("folder") ?? ""),
      tags,
      group: form.get("group") ? String(form.get("group")) : undefined,
      exif: ExifPolicy.safeParse(form.get("exif")).data,
    },
  };
}

/** POST handler for the admin: multipart → JSON results per file. Signed in as an editor via the session cookie. */
export async function uploadAssets(admin: AdminContext, req: Request): Promise<Response> {
  const session = await admin.auth.editingSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const upload = await readUploadForm(req);
  if (!upload) return Response.json({ error: "Expected a multipart upload" }, { status: 400 });
  if (upload.files.length === 0) return Response.json({ error: "No files" }, { status: 400 });
  try {
    const results = await ingestFiles(admin, userSubject(session.name, session.role), upload.files, { ...upload.opts, by: session.name });
    return Response.json({ results });
  } catch (err) {
    if (err instanceof IngestRefused) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tif: "image/tiff",
  pdf: "application/pdf",
  zip: "application/zip",
  json: "application/json",
  glb: "model/gltf-binary",
  wav: "audio/wav",
  mid: "audio/midi",
};

/**
 * A file as a streamed response, with HTTP Range support (a player seeks by
 * asking for byte ranges) — also the shape an S3 backend will answer in.
 */
async function fileResponse(admin: AdminContext, rel: string, cache: string, range: string | null): Promise<Response> {
  const assets = admin.imprint.assets;
  const stat = await assets.stat(rel);
  if (!stat) return new Response("Not found", { status: 404 });
  const size = stat.size;
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const headers: Record<string, string> = {
    "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": cache,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  // An SVG opened on its own must not run script on the site's origin.
  if (ext === "svg") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

  let start = 0;
  let end = size - 1;
  let status = 200;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (range && !m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (m) {
    if (m[1] === "" && m[2] !== "") {
      start = Math.max(0, size - Number(m[2])); // the last N bytes
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(size === 0 ? 0 : end - start + 1);
  if (size === 0) return new Response(new Uint8Array(0), { status, headers });
  // Disk or bucket: the store streams the requested bytes (an S3 range request for a bucket).
  const stream = await assets.read(rel, status === 206 ? { start, end } : undefined);
  if (!stream) return new Response("Not found", { status: 404 });
  return new Response(stream, { status, headers });
}

const PUBLIC_CACHE = "public, max-age=31536000, immutable";
const PRIVATE_CACHE = "private, max-age=3600";

/**
 * GET handler for `/api/assets/<path>`. Files outside the library (board
 * renders, pinouts) are public as before; a library file is served according
 * to its asset's record — a visitor gets only what §7 allows. Pass the
 * request's Range header for partial responses.
 */
export async function serveAsset(admin: AdminContext, parts: string[], range: string | null = null): Promise<Response> {
  const rel = parts.join("/");
  if (!rel.startsWith(LIBRARY)) return fileResponse(admin, rel, PUBLIC_CACHE, range);

  const slug = rel.slice(LIBRARY.length).split("/")[0];
  const record = admin.imprint.writableStore ? await admin.imprint.writableStore.getItem("asset", slug) : null;
  const parsed = record ? AssetRecordSchema.safeParse(record.data) : null;
  if (!parsed?.success) return new Response("Not found", { status: 404 });
  const asset = parsed.data;

  const url = `${admin.imprint.assets.urlBase.replace(/\/$/, "")}/${rel}`;
  const need = fileAccess(asset, url);
  if (need === "none") return new Response("Not found", { status: 404 });
  if (need === "public") return fileResponse(admin, rel, PUBLIC_CACHE, range);

  const session = await admin.auth.getSession();
  if (!session) return new Response("Not available", { status: 403 });
  const subject = userSubject(session.name, session.role);
  const resource = contentResource("asset", slug, asset);
  // A reader may see the restricted formats a signed-in person may read; the
  // original and the large formats need edit rights (or, later, a purchase).
  const allowed = await permit(admin.imprint.pdp, subject, need === "reader" ? "read" : "update", resource);
  return allowed ? fileResponse(admin, rel, PRIVATE_CACHE, range) : new Response("Not available", { status: 403 });
}

const OPTIONAL_META = ["caption", "credit", "licence", "source", "publicMaxWidth", "focus"] as const;

/** The members of an asset's group (itself included), or just the asset. */
async function withGroup(admin: AdminContext, slug: string) {
  const store = admin.imprint.writableStore!;
  const current = await store.getItem("asset", slug);
  if (!current) return null;
  const group = (current.data as { group?: string }).group;
  const members = group
    ? (await store.listItems("asset")).filter((r) => (r.data as { group?: string }).group === group)
    : [current];
  return { current, members };
}

/**
 * Merge the editable fields into the asset. Moving to another folder moves
 * the whole group (§12.3); the other fields belong to this file only.
 */
export async function saveAsset(admin: AdminContext, slug: string, meta: Record<string, unknown>): Promise<ActionResult> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const found = await withGroup(admin, slug);
  if (!found) return { ok: false, error: `No asset "${slug}"` };
  const { current, members } = found;

  const clean: Record<string, unknown> = {
    ...meta,
    folder: normalizeFolder(String(meta.folder ?? "")),
    tags: Array.isArray(meta.tags) ? [...new Set(meta.tags.map((t) => normalizeTag(String(t))).filter(Boolean))] : [],
  };
  for (const key of OPTIONAL_META) if (clean[key] === "" || clean[key] === null) delete clean[key];
  const parsed = AssetMetaSchema.safeParse(clean);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };

  const data: Record<string, unknown> = { ...(current.data as Record<string, unknown>) };
  const movedFrom = data.folder;
  for (const [key, value] of Object.entries(parsed.data)) data[key] = value;
  // A cleared optional field is removed, not kept from the previous version.
  for (const key of OPTIONAL_META) if (!(key in clean)) delete data[key];

  try {
    await store.putItem("asset", slug, data, { lang: current.lang, by: session.name });
    if (data.folder !== movedFrom) {
      for (const m of members) {
        if (m.slug === slug) continue;
        await store.putItem("asset", m.slug, { ...(m.data as Record<string, unknown>), folder: data.folder }, { lang: m.lang, by: session.name });
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidateSite();
  return { ok: true };
}

/** A tombstone like any delete (the files stay for History); with `group`, every member of the asset's group. */
export async function deleteAsset(admin: AdminContext, slug: string, opts: { group?: boolean } = {}): Promise<ActionResult> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const found = await withGroup(admin, slug);
  if (!found) return { ok: false, error: `No asset "${slug}"` };
  for (const m of opts.group ? found.members : [found.current]) await store.deleteItem("asset", m.slug, m.lang);
  revalidateSite();
  return { ok: true };
}

/**
 * Create or update a tag list from the library (§4). A tag's slug comes from
 * its label; an existing list keeps the tags it had unless they are passed.
 */
export async function saveTaglist(admin: AdminContext, slug: string | null, list: Record<string, unknown>): Promise<ActionResult & { slug?: string }> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const name = String(list.name ?? "").trim();
  const target = slug ?? normalizeGroup(name);
  if (!target) return { ok: false, error: "A tag list needs a name" };
  const current = await store.getItem("taglist", target);
  if (!slug && current) return { ok: false, error: `A tag list "${target}" already exists` };

  const tags = Array.isArray(list.tags)
    ? (list.tags as { label?: unknown; slug?: unknown }[])
        .map((t) => {
          const label = String(t.label ?? "").trim();
          return { label, slug: normalizeGroup(String(t.slug ?? "") || label) };
        })
        .filter((t) => t.label && t.slug)
        .filter((t, i, all) => all.findIndex((o) => o.slug === t.slug) === i)
    : undefined;
  const parsed = TaglistSchema.safeParse({
    ...(current?.data as Record<string, unknown> | undefined),
    ...list,
    slug: target,
    name: name || (current?.data as { name?: string } | undefined)?.name,
    ...(tags ? { tags } : {}),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  await store.putItem("taglist", target, parsed.data, { lang: parsed.data.lang, by: session.name });
  return { ok: true, slug: target };
}

/** Rewrite the tags of every asset that has `from`: to `to`, or drop it when `to` is null. Returns how many changed. */
async function retagAssets(admin: AdminContext, by: string, from: (tag: string) => boolean, to: (tag: string) => string | null): Promise<number> {
  const store = admin.imprint.writableStore!;
  let changed = 0;
  for (const r of await store.listItems("asset")) {
    const data = r.data as Record<string, unknown> & { tags?: string[] };
    const tags = data.tags ?? [];
    if (!tags.some(from)) continue;
    const next = [...new Set(tags.flatMap((t) => (from(t) ? (to(t) === null ? [] : [to(t)!]) : [t])))];
    await store.putItem("asset", r.slug, { ...data, tags: next }, { lang: r.lang, by });
    changed++;
  }
  return changed;
}

/**
 * Fix a tag in a list (§4): rename it (its slug follows the label, and every
 * file that has it is updated — a new version, so History shows it; renaming
 * onto an existing tag merges the two) or remove it (also from the files).
 */
export async function editTag(
  admin: AdminContext,
  list: string,
  tag: string,
  change: { label?: string; remove?: boolean }
): Promise<ActionResult & { affected?: number }> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const current = await store.getItem("taglist", list);
  if (!current) return { ok: false, error: `No tag list "${list}"` };
  const data = TaglistSchema.parse(current.data);
  const old = data.tags.find((t) => t.slug === tag);
  if (!old) return { ok: false, error: `No tag "${tag}" in "${data.name}"` };
  const oldKey = `${list}/${tag}`;

  let tags = data.tags;
  let to: string | null = null;
  if (change.remove) {
    tags = tags.filter((t) => t.slug !== tag);
  } else {
    const label = String(change.label ?? "").trim();
    const slug = normalizeGroup(label);
    if (!label || !slug) return { ok: false, error: "A tag needs a name" };
    const merged = slug !== tag && tags.some((t) => t.slug === slug);
    tags = merged ? tags.filter((t) => t.slug !== tag) : tags.map((t) => (t.slug === tag ? { slug, label } : t));
    to = `${list}/${slug}`;
  }
  await store.putItem("taglist", list, { ...data, tags }, { lang: current.lang, by: session.name });
  const affected = to === oldKey ? 0 : await retagAssets(admin, session.name, (t) => t === oldKey, () => to);
  revalidateSite();
  return { ok: true, affected };
}

/** Remove a tag list; its tags are removed from every file that has them. */
export async function deleteTaglist(admin: AdminContext, list: string): Promise<ActionResult & { affected?: number }> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const current = await store.getItem("taglist", list);
  if (!current) return { ok: false, error: `No tag list "${list}"` };
  const affected = await retagAssets(admin, session.name, (t) => t.startsWith(`${list}/`), () => null);
  await store.deleteItem("taglist", list, current.lang);
  revalidateSite();
  return { ok: true, affected };
}

/** One entry of the library index the admin's pickers load. */
export type LibraryIndexEntry = {
  slug: string;
  title: string;
  alt: string;
  kind: string;
  folder: string;
  tags: string[];
  filename: string;
  /** Small version, for thumbnails. */
  thumb: string;
  /** What a page shows (the widest public version, or the original). */
  display: string;
};

/**
 * GET handler for the admin's asset pickers (§3): the whole library, lean.
 * Session-based like the upload next to it; the external API is /api/media.
 */
export async function libraryIndex(admin: AdminContext): Promise<Response> {
  const session = await admin.auth.editingSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const store = admin.imprint.writableStore;
  if (!store) return Response.json({ assets: [] });
  const assets: LibraryIndexEntry[] = (await store.listItems("asset"))
    .sort((a, b) => b.txFrom.getTime() - a.txFrom.getTime())
    .flatMap((r) => {
      const parsed = AssetRecordSchema.safeParse(r.data);
      if (!parsed.success) return [];
      const a = parsed.data;
      return [
        {
          slug: a.slug,
          title: a.title,
          alt: a.alt,
          kind: a.file.kind,
          folder: a.folder,
          tags: a.tags,
          filename: a.file.filename,
          thumb: thumbUrl(a),
          display: a.file.kind === "image" ? displayUrl(a) : a.file.original,
        },
      ];
    });
  return Response.json({ assets }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * The route handler for `/api/assets/<path>` (GET and the CORS preflight):
 * `serveAsset`, plus CORS for the origins in `media.cors` — the same list as
 * the media API, so a client there (the patch editor) can `fetch()` a file it
 * found through /api/media. Reading only, never with credentials: what a
 * visitor may not see stays 403 for another origin too.
 */
export async function assetsRoute(admin: AdminContext, req: Request, parts: string[]): Promise<Response> {
  const origin = req.headers.get("origin");
  const allowed = origin !== null && admin.imprint.media.cors.includes(origin);
  const cors: Record<string, string> = allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
        "Access-Control-Max-Age": "600",
      }
    : {};
  // The answer differs per origin once there is a list: caches must keep them apart.
  if (admin.imprint.media.cors.length > 0) cors.Vary = "Origin";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const res = parts[0] === "_ref" && parts.length === 2 ? await assetRedirect(admin, req, parts[1]) : await serveAsset(admin, parts, req.headers.get("range"));
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

/**
 * `/api/assets/_ref/<slug>`: where an `asset:<slug>` inside markdown leads
 * (step 6). A redirect to what a page would show — the widest public version
 * of an image, the original of other files — so markdown, rendered
 * synchronously, still follows the library. Not found or not visible: 404,
 * like the file itself would be. Short cache: the target changes when the
 * asset does. `_ref` cannot clash with a stored path (slugs have no `_`).
 */
async function assetRedirect(admin: AdminContext, req: Request, slug: string): Promise<Response> {
  const record = admin.imprint.writableStore ? await admin.imprint.writableStore.getItem("asset", slug) : null;
  const parsed = record ? AssetRecordSchema.safeParse(record.data) : null;
  if (!parsed?.success) return new Response("Not found", { status: 404 });
  const asset = parsed.data;
  if (asset.access === "restricted") {
    const session = await admin.auth.getSession();
    const ok = session && (await permit(admin.imprint.pdp, userSubject(session.name, session.role), "read", contentResource("asset", slug, asset)));
    if (!ok) return new Response("Not found", { status: 404 });
  }
  const target = asset.file.kind === "image" ? displayUrl(asset) : asset.file.original;
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(target, req.url).toString(), "Cache-Control": asset.access === "public" ? "public, max-age=300" : "private, no-store" },
  });
}
