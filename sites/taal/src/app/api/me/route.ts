import { auth } from "@/lib/admin";

/**
 * Who is looking, for the account link in the header. Public pages stay
 * prerendered; only this small request is per visitor.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.getSession();
  return Response.json(session ? { name: session.name } : null, { headers: { "Cache-Control": "no-store" } });
}
