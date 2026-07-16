import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { ASOF_COOKIE } from "@/lib/preview";

/** Leave as-of preview: back to the normal (prerendered, current) site. */
export async function GET(req: Request) {
  (await draftMode()).disable();
  (await cookies()).delete(ASOF_COOKIE);
  const to = new URL(req.url).searchParams.get("to") ?? "/";
  redirect(to.startsWith("/") ? to : "/");
}
