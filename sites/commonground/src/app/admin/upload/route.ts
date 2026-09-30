import { libraryIndex, uploadAssets } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/**
 * The media library for the admin (design/beeldbibliotheek.md): POST uploads
 * (multipart, checked and processed in the engine), GET is the index the
 * asset pickers in forms and widget editors load.
 */
export async function POST(req: Request): Promise<Response> {
  return uploadAssets(admin, req);
}

export async function GET(): Promise<Response> {
  return libraryIndex(admin);
}
