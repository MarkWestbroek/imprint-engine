import { readOpts } from "@imprint/runtime-admin";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";

/** The public site: header with the "main" menu and the language choice, the page, the footer. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const opts = await readOpts();
  const [menu, site] = await Promise.all([store.getMenu("main", opts), store.getSiteConfig(opts)]);
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} name={site.name} tagline={site.tagline} />
      <main className="tl-main">
        <div className="tl-container tl-page">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
