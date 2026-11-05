import { redirect } from "next/navigation";
import { readOpts } from "@imprint/runtime-admin";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { auth } from "@/lib/admin";
import { store } from "@/lib/content";

// A closed workplace: every page reads the session cookie, so nothing is prerendered.
export const dynamic = "force-dynamic";

/** Signed in or not at all: without a session, to the login of the admin. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.getSession();
  if (!session) redirect("/admin");
  const menu = await store.getMenu("main", await readOpts());
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} user={session.name} />
      <main className="ir-main">
        <article className="ir-container ir-page">{children}</article>
      </main>
      <SiteFooter />
    </>
  );
}
