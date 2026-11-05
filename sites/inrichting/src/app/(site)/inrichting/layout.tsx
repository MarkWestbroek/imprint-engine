import { redirect } from "next/navigation";
import { auth } from "@/lib/admin";

/**
 * Everything from the register is behind the login: the register itself only
 * shows its records to a signed-in reader (LEESTOEGANG=documenten), and this
 * site must not hand them out with its reader token to anyone.
 */
export default async function InrichtingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await auth.getSession())) redirect("/admin");
  return children;
}
