import { readOpts } from "@imprint/runtime-admin";
import { menus, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";

/** The public site: header with the menus of the entrances and the language choice, the page, the footer. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const opts = await readOpts();
  const [nav, site] = await Promise.all([menus(opts), store.getSiteConfig(opts)]);
  return (
    <>
      <SiteHeader menus={nav} name={site.name} tagline={site.tagline} />
      <main className="tl-main">
        <div className="tl-container tl-page">{children}</div>
      </main>
      <SiteFooter menus={nav} name={site.name} tagline={site.tagline} />
    </>
  );
}
