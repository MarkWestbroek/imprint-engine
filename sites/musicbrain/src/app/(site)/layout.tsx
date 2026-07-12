import { store } from "@/lib/content";
import { menuToNav, SiteChrome } from "@/components/site-chrome";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const site = await store.getSiteConfig();
  const menu = await store.getMenu("main");
  return (
    <SiteChrome site={site} nav={menuToNav(menu)}>
      {children}
    </SiteChrome>
  );
}
