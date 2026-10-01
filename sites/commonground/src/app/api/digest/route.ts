import { digestApi } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/**
 * The daily mail digest of notifications (design/communities.md §4.4): called
 * by cron on the VPS (`deploy.sh digest commonground`) with the site's
 * INGEST_TOKEN. `?dry=1` reports what would be sent without sending.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return digestApi(admin, req);
}
