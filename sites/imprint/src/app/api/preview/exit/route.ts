import { previewExit } from "@imprint/runtime-admin/admin-server";

/** Leave as-of preview: back to the normal (prerendered, current) site. */
export const GET = (req: Request) => previewExit(req);
