import { mediaApiItem } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** Replace one asset's file (design/beeldbibliotheek.md §12.4): PUT with a personal API token. */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  return mediaApiItem(admin, req, (await ctx.params).slug);
}

export async function OPTIONS(req: Request, ctx: Ctx): Promise<Response> {
  return mediaApiItem(admin, req, (await ctx.params).slug);
}
