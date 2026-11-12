import { previewEnter } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** Enter as-of preview: GET /api/preview?asOf=<iso>&to=<path> (editors only). */
export const GET = (req: Request) => previewEnter(admin, req);
