import { promises as fs } from "node:fs";
import { revalidatePath } from "next/cache";
import {
  AssetMetaSchema,
  AssetRecordSchema,
  contentResource,
  ExifPolicy,
  permit,
  userSubject,
  type AssetRecord,
} from "@imprint/content-core";
import type { AdminContext } from "../admin-context";
import type { ActionResult } from "../admin/types";
import { fileAccess } from "../media/access";
import { processUpload, slugFromFilename, uniqueSlug, UploadError } from "../media/process";

/**
 * The media library's server side (design/beeldbibliotheek.md): the upload
 * and serving route handlers and the two actions. A site mounts the handlers
 * with one-line route files (they take the `AdminContext`, like everything in
 * admin-server) and wraps the actions in its "use server" module.
 *
 * Files of a library asset live under `library/<slug>/` in the AssetStore.
 * Serving goes through `serveAsset`, which decides per file with the asset's
 * record (§7: access per format; the original is never public).
 */

const LIBRARY = "library/";

/** "Externe  Afbeeldingen//2026/" → "externe afbeeldingen/2026". */
export function normalizeFolder(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split("/")
    .map((s) => s.replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("/");
}

const titleFromFilename = (name: string) => name.replace(/\.[^.]*$/, "").replace(/[-_]+/g, " ").trim();

/** POST handler: multipart `file` (one or more), `folder`, `exif` → JSON results per file. */
export async function uploadAssets(admin: AdminContext, req: Request): Promise<Response> {
  const session = await admin.auth.editingSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const store = admin.imprint.writableStore;
  if (!store) return Response.json({ error: "The media library requires DATABASE_URL" }, { status: 409 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected a multipart upload" }, { status: 400 });
  }
  const folder = normalizeFolder(String(form.get("folder") ?? ""));
  const policy = ExifPolicy.safeParse(form.get("exif")).data ?? "no-location";
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: "No files" }, { status: 400 });

  const taken = new Set((await store.listItems("asset")).map((r) => r.slug));
  const results: { name: string; ok: boolean; slug?: string; error?: string }[] = [];

  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const processed = await processUpload(bytes, policy);
      const slug = uniqueSlug(slugFromFilename(file.name), taken);
      const assets = admin.imprint.assets;
      const original = await assets.put(`${LIBRARY}${slug}/original.${processed.ext}`, bytes);
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
        file: {
          filename: file.name,
          kind: processed.kind,
          mime: processed.mime,
          size: bytes.byteLength,
          width: processed.width,
          height: processed.height,
          original,
          variants,
          exif: policy,
        },
        photo: processed.photo,
        gps: processed.gps,
      });
      await store.putItem("asset", slug, data, { lang: "en", by: session.name });
      taken.add(slug);
      results.push({ name: file.name, ok: true, slug });
    } catch (err) {
      const message = err instanceof UploadError || err instanceof Error ? err.message : String(err);
      results.push({ name: file.name, ok: false, error: message });
    }
  }
  return Response.json({ results });
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
};

async function fileResponse(admin: AdminContext, rel: string, cache: string): Promise<Response> {
  try {
    const bytes = await fs.readFile(admin.imprint.assets.resolve(rel));
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const headers: Record<string, string> = {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    };
    // An SVG opened on its own must not run script on the site's origin.
    if (ext === "svg") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    return new Response(new Uint8Array(bytes), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const PUBLIC_CACHE = "public, max-age=31536000, immutable";
const PRIVATE_CACHE = "private, max-age=3600";

/**
 * GET handler for `/api/assets/<path>`. Files outside the library (board
 * renders, pinouts) are public as before; a library file is served according
 * to its asset's record — a visitor gets only what §7 allows.
 */
export async function serveAsset(admin: AdminContext, parts: string[]): Promise<Response> {
  const rel = parts.join("/");
  if (!rel.startsWith(LIBRARY)) return fileResponse(admin, rel, PUBLIC_CACHE);

  const slug = rel.slice(LIBRARY.length).split("/")[0];
  const record = admin.imprint.writableStore ? await admin.imprint.writableStore.getItem("asset", slug) : null;
  const parsed = record ? AssetRecordSchema.safeParse(record.data) : null;
  if (!parsed?.success) return new Response("Not found", { status: 404 });
  const asset = parsed.data;

  const url = `${admin.imprint.assets.urlBase.replace(/\/$/, "")}/${rel}`;
  const need = fileAccess(asset, url);
  if (need === "none") return new Response("Not found", { status: 404 });
  if (need === "public") return fileResponse(admin, rel, PUBLIC_CACHE);

  const session = await admin.auth.getSession();
  if (!session) return new Response("Not available", { status: 403 });
  const subject = userSubject(session.name, session.role);
  const resource = contentResource("asset", slug, asset);
  // A reader may see the restricted formats a signed-in person may read; the
  // original and the large formats need edit rights (or, later, a purchase).
  const allowed = await permit(admin.imprint.pdp, subject, need === "reader" ? "read" : "update", resource);
  return allowed ? fileResponse(admin, rel, PRIVATE_CACHE) : new Response("Not available", { status: 403 });
}

const OPTIONAL_META = ["caption", "credit", "licence", "source", "publicMaxWidth", "focus"] as const;

export async function saveAsset(admin: AdminContext, slug: string, meta: Record<string, unknown>): Promise<ActionResult> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const current = await store.getItem("asset", slug);
  if (!current) return { ok: false, error: `No asset "${slug}"` };

  const clean: Record<string, unknown> = { ...meta, folder: normalizeFolder(String(meta.folder ?? "")) };
  for (const key of OPTIONAL_META) if (clean[key] === "" || clean[key] === null) delete clean[key];
  const parsed = AssetMetaSchema.safeParse(clean);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };

  const data: Record<string, unknown> = { ...(current.data as Record<string, unknown>) };
  for (const [key, value] of Object.entries(parsed.data)) data[key] = value;
  // A cleared optional field is removed, not kept from the previous version.
  for (const key of OPTIONAL_META) if (!(key in clean)) delete data[key];

  try {
    await store.putItem("asset", slug, data, { lang: current.lang, by: session.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAsset(admin: AdminContext, slug: string): Promise<ActionResult> {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  if (!session || !store) return { ok: false, error: "Not signed in" };
  const current = await store.getItem("asset", slug);
  if (!current) return { ok: false, error: `No asset "${slug}"` };
  await store.deleteItem("asset", slug, current.lang);
  revalidatePath("/", "layout");
  return { ok: true };
}
