import { redirect } from "next/navigation";
import { confirmEmail } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { accountPad } from "@/lib/account-teksten";

/** The link in the verification mail: one use, then on to the account page (or to signing in). */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ ui: string }> }) {
  const { ui } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const user = await confirmEmail(admin, token);
  redirect(`${accountPad(ui)}?verified=${user ? "1" : "0"}`);
}
