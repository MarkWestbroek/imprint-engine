import { revalidatePath } from "next/cache";
import { TOKEN_SCOPES, type TokenScope } from "@imprint/content-core/user-store";
import type { AdminContext } from "../admin-context";
import type { TokenActionResult } from "../admin/types";

/**
 * Personal API tokens (design/beeldbibliotheek.md §12.4), managed by their
 * owner on the account screen. Every signed-in user manages only their own;
 * the token itself is shown once, in the answer to `createToken`.
 */

const DAY = 24 * 60 * 60 * 1000;

export async function createToken(admin: AdminContext, _prev: TokenActionResult | null, formData: FormData): Promise<TokenActionResult> {
  const session = await admin.auth.getSession();
  if (!session) return { ok: false, error: "Not signed in" };
  if (!admin.imprint.users) return { ok: false, error: "API tokens require DATABASE_URL" };
  try {
    const scopes = formData.getAll("scopes").map(String).filter((s): s is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(s));
    const days = Number(formData.get("days") ?? 0);
    const expiresAt = days > 0 ? new Date(Date.now() + days * DAY) : null;
    const { token } = await admin.imprint.users.createToken(session.name, String(formData.get("name") ?? ""), scopes, { expiresAt });
    revalidatePath("/admin/users");
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function revokeToken(admin: AdminContext, _prev: TokenActionResult | null, formData: FormData): Promise<TokenActionResult> {
  const session = await admin.auth.getSession();
  if (!session || !admin.imprint.users) return { ok: false, error: "Not signed in" };
  try {
    await admin.imprint.users.revokeToken(session.name, Number(formData.get("id")));
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
