import { mediaApi } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/**
 * The media API for clients outside the admin (design/beeldbibliotheek.md
 * §12.4): a personal API token, CORS for the origins in imprint.config.ts.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return mediaApi(admin, req);
}

export async function POST(req: Request): Promise<Response> {
  return mediaApi(admin, req);
}

export async function OPTIONS(req: Request): Promise<Response> {
  return mediaApi(admin, req);
}
