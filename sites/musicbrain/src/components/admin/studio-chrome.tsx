import type { ReactNode } from "react";
import { store } from "@/lib/content";
import { menuToNav, SiteChrome } from "@/components/site-chrome";

/**
 * The site's chrome around the studio canvas (AdminContext.studio.chrome):
 * the real header, menu, themes and footer, in the inert stand so nothing
 * in it navigates while editing.
 */
export async function StudioChrome({ children }: { children: ReactNode }) {
  const [site, menu, themes] = await Promise.all([
    store.getSiteConfig(),
    store.getMenu("main"),
    store.listThemes(),
  ]);
  return (
    <SiteChrome site={site} nav={menuToNav(menu)} themes={themes} inert>
      {children}
    </SiteChrome>
  );
}
