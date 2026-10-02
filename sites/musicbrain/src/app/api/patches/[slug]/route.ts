import { patchesApiItem } from "@imprint/plugin-patches";
import { admin } from "@/lib/admin";

/** One patch of the pool: PATCH turns your own private patch into a proposal or a question (plugin-patches). */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  return patchesApiItem(admin, req, (await params).slug);
}

export async function OPTIONS(req: Request, { params }: Ctx): Promise<Response> {
  return patchesApiItem(admin, req, (await params).slug);
}
