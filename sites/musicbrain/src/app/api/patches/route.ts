import { patchesApi } from "@imprint/plugin-patches";
import { admin } from "@/lib/admin";

/**
 * The patch pool's API for the editor (MusicBrain doc/plans/patch-pool.md
 * §8 step 1): a personal API token with scope patch:propose, CORS for the
 * origins in imprint.config.ts (`media.cors`, the same list as /api/media).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return patchesApi(admin, req);
}

export async function POST(req: Request): Promise<Response> {
  return patchesApi(admin, req);
}

export async function OPTIONS(req: Request): Promise<Response> {
  return patchesApi(admin, req);
}
