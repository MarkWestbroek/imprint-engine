import { readOpts } from "@imprint/runtime-admin";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { auth } from "@/lib/admin";
import { store } from "@/lib/content";

// The header shows who is signed in, so every page reads the session cookie; nothing is prerendered.
export const dynamic = "force-dynamic";

/**
 * The explanation pages are public; everything from the register sits under
 * /inrichting, behind the login (app/(site)/inrichting/layout.tsx). On a public
 * page the register widgets render only for a signed-in visitor (PageView).
 */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [session, menu] = await Promise.all([auth.getSession(), store.getMenu("main", await readOpts())]);
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} user={session?.name} />
      <main className="ir-main">
        <article className="ir-container ir-page">{children}</article>
      </main>
      <SiteFooter />
    </>
  );
}
