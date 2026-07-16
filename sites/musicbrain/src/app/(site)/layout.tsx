import { store } from "@/lib/content";
import { menuToNav, SiteChrome } from "@/components/site-chrome";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const site = await store.getSiteConfig();
  const menu = await store.getMenu("main");
  const themes = await store.listThemes();
  return (
    <SiteChrome site={site} nav={menuToNav(menu)} themes={themes}>
      {children}
    </SiteChrome>
  );
}
