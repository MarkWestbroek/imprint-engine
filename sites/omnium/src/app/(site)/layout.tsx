import { readOpts } from "@imprint/runtime-admin";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";

/** The public site: header with the "main" menu, the page, the footer. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const menu = await store.getMenu("main", await readOpts());
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} />
      <main className="om-main">
        <article className="om-container om-page">{children}</article>
      </main>
      <SiteFooter />
    </>
  );
}
