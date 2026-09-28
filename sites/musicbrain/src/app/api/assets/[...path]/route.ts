import { serveAsset } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/**
 * Serves the AssetStore's files. Outside the media library they are public;
 * a library file is served according to its asset (access per format, the
 * original never public — design/beeldbibliotheek.md §7).
 */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  return serveAsset(admin, path, req.headers.get("range"));
}
