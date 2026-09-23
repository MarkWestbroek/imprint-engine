import { timingSafeEqual } from "node:crypto";
import type { UserStore } from "@imprint/content-core/user-store";
import { createSessionAuth } from "@imprint/runtime-admin/admin-server";
import type { AdminSession } from "@imprint/runtime-admin";
import { imprint } from "@/lib/content";

/**
 * This site's session: the shared admin's cookie session (runtime-admin
 * admin-server/session.ts) bound to this instance — cookie name, hours, secret
 * and users all come from `imprint.config.ts`. The same object goes into the
 * AdminContext (lib/admin.ts).
 */
export const auth = createSessionAuth(imprint);

export type Session = AdminSession;

/** User CRUD for /admin/users. Null in file mode: v0 has no users table. */
export const userStore: UserStore | null = imprint.users;

export const getSession = auth.getSession;
export const editingSession = auth.editingSession;
export const canEdit = auth.canEdit;

/**
 * Bearer-token check for machine-to-machine writes (product-projects posting
 * content/assets). Constant-time; an unset INGEST_TOKEN disables writes.
 */
export function checkIngestToken(req: Request): boolean {
  const token = imprint.secrets.ingestToken;
  if (!token) return false;
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
