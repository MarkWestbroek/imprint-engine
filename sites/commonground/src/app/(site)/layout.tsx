import { readOpts } from "@imprint/runtime-admin";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { FooterContent } from "@/components/page-view";
import { store } from "@/lib/content";

/** The public site: header with the "main" menu, the page, and the footer page. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const opts = await readOpts();
  const [menu, themes] = await Promise.all([store.getMenu("main", opts), store.listThemes(opts)]);
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} themes={themes.map((t) => ({ name: t.name, label: t.label, colors: { background: t.colors.background, accent: t.colors.accent, accent2: t.colors.accent2 || t.colors.accent } }))} />
      <main className="cg-main">
        <div className="cg-container">{children}</div>
      </main>
      <SiteFooter>
        <FooterContent />
      </SiteFooter>
    </>
  );
}
