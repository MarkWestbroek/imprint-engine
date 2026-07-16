import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { BoardSpecSchema } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { assetStore } from "@/lib/assets";
import { checkIngestToken } from "@/lib/auth";

/**
 * Board-spec ingest (D5, D6): the KiCad toolkit POSTs one multipart request
 * with the board-spec JSON plus its rendered files. The backend stores each
 * file via the AssetStore, rewrites asset *names* in the doc to their URLs,
 * validates, and asserts a new board-spec version (bitemporal put — reposting
 * supersedes, keeping history).
 *
 *   POST /api/ingest/board-spec   (Authorization: Bearer <INGEST_TOKEN>)
 *   multipart/form-data:
 *     doc   = JSON board-spec, assets referenced by bare filename
 *     <any> = the files (render-top.png, overview.svg, pinout-J1.svg, …)
 */

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Replace any string equal to an uploaded filename with its stored URL. */
function rewriteAssets(value: unknown, urls: Record<string, string>): unknown {
  if (typeof value === "string") return urls[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => rewriteAssets(v, urls));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rewriteAssets(v, urls)])
    );
  }
  return value;
}

export async function POST(req: NextRequest) {
  if (!checkIngestToken(req)) return error(401, "Missing or invalid ingest token");
  if (!writableStore) return error(503, "Writes require DATABASE_URL");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, "Expected multipart/form-data");
  }

  const docRaw = form.get("doc");
  if (typeof docRaw !== "string") return error(400, "Missing 'doc' field (JSON board-spec)");
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(docRaw) as Record<string, unknown>;
  } catch {
    return error(400, "'doc' is not valid JSON");
  }

  const component = String(doc.component ?? "");
  const version = String(doc.version ?? "");
  if (!component || !version) {
    return error(400, "board-spec needs 'component' and 'version'");
  }

  // Store every uploaded file under <component>/<version>/, remembering URLs.
  const urls: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key === "doc" || !(value instanceof File)) continue;
    const bytes = new Uint8Array(await value.arrayBuffer());
    urls[value.name] = await assetStore.put(`${component}/${version}/${value.name}`, bytes);
  }

  const rewritten = rewriteAssets(doc, urls) as Record<string, unknown>;
  const slug = String(rewritten.slug ?? `${component}@${version}`);
  rewritten.slug = slug;

  // Validate here for a clean 422; putItem validates again + checks references.
  const parsed = BoardSpecSchema.safeParse(rewritten);
  if (!parsed.success) return error(422, parsed.error.message);

  try {
    await writableStore.putItem("board-spec", slug, parsed.data, {
      lang: parsed.data.lang,
      by: "ingest:board-spec",
    });
  } catch (err) {
    return error(422, err instanceof Error ? err.message : String(err));
  }

  revalidatePath("/", "layout"); // flush the public site's cache

  // DX (MMB-vraag 6): meld of deze componentversie door een release gepind
  // wordt — een ongepinde versie verschijnt nergens op productpagina's, en
  // dat gat is anders onzichtbaar tot je de hele keten naloopt.
  const releases = await writableStore.listItems("release");
  const pinnedBy = releases
    .filter((r) =>
      ((r.data as { components?: { component: string; version: string }[] }).components ?? []).some(
        (c) => c.component === component && c.version === version
      )
    )
    .map((r) => r.slug);

  return NextResponse.json({
    ok: true,
    slug,
    assets: urls,
    pinned_by: pinnedBy,
    ...(pinnedBy.length === 0 && {
      warning: `No release pins ${component}@${version} yet — it won't appear on product pages until one does (see mmb-ingest-guide.md, "Het volledige pad").`,
    }),
  });
}
