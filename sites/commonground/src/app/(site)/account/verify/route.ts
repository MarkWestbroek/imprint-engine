import { redirect } from "next/navigation";
import { confirmEmail } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

/** The link in the verification mail: one use, then on to the account page. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const user = await confirmEmail(admin, token);
  redirect(user ? "/account?verified=1" : "/account?verified=0");
}
