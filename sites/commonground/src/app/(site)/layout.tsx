import { readOpts } from "@imprint/runtime-admin";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { FooterContent } from "@/components/page-view";
import { store } from "@/lib/content";

/** The public site: header with the "main" menu, the page, and the footer page. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const menu = await store.getMenu("main", await readOpts());
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} />
      <main className="cg-main">
        <div className="cg-container">{children}</div>
      </main>
      <SiteFooter>
        <FooterContent />
      </SiteFooter>
    </>
  );
}
