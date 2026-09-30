import { auth } from "@/lib/admin";

/**
 * Who is looking — for the chrome's user tools (components/user-tools.tsx).
 * Public pages stay prerendered; only this small request is per visitor.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.getSession();
  if (!session) return Response.json(null, { headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { name: session.name, role: session.role, canEdit: await auth.canEdit(session) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
