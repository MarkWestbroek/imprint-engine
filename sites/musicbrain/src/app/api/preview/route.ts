import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { canEdit, getSession } from "@/lib/auth";
import { ASOF_COOKIE } from "@/lib/preview";

/**
 * Enter as-of preview: GET /api/preview?asOf=<iso>&to=<path>. Editors only —
 * this flips draft mode on, so the public pages render dynamically (with
 * drafts and the chosen moment) for this browser until /api/preview/exit.
 */
export async function GET(req: Request) {
  if (!canEdit(await getSession())) {
    return new Response("Editors only", { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const asOf = new Date(params.get("asOf") ?? "");
  if (Number.isNaN(asOf.getTime())) {
    return new Response("Pass ?asOf=<date or ISO timestamp>", { status: 400 });
  }
  const to = params.get("to") ?? "/";
  if (!to.startsWith("/")) return new Response("`to` must be a site path", { status: 400 });

  (await draftMode()).enable();
  (await cookies()).set(ASOF_COOKIE, asOf.toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(to);
}
