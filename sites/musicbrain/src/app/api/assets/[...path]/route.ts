import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { assetStore } from "@/lib/assets";

/**
 * Serves assets stored by the AssetStore (D3). Serving through a route rather
 * than public/ keeps dev and Plesk identical and lets the store live anywhere
 * on disk; a later MinIO/S3 store would hand out direct URLs and skip this.
 */

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  zip: "application/zip",
  json: "application/json",
  glb: "model/gltf-binary",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  // resolve() sanitizes and keeps the path inside the asset root.
  const file = assetStore.resolve(rel);
  try {
    const bytes = await fs.readFile(file);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
