import { assetsRoute } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/**
 * Serves the AssetStore's files. Outside the media library they are public;
 * a library file is served according to its asset (access per format, the
 * original never public — design/beeldbibliotheek.md §7). Origins listed in
 * `media.cors` may read them with fetch() (§12.4).
 */
type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  return assetsRoute(admin, req, (await ctx.params).path);
}

export async function OPTIONS(req: Request, ctx: Ctx): Promise<Response> {
  return assetsRoute(admin, req, (await ctx.params).path);
}
