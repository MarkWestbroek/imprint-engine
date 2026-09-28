import { uploadAssets } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** Upload into the media library (design/beeldbibliotheek.md): multipart, checked and processed in the engine. */
export async function POST(req: Request): Promise<Response> {
  return uploadAssets(admin, req);
}
