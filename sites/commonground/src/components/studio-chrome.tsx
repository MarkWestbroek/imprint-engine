import type { ReactNode } from "react";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { FooterContent } from "@/components/page-view";
import { store } from "@/lib/content";

/**
 * The site's chrome around the studio canvas (AdminContext.studio.chrome):
 * the real header, menu and footer, not clickable while editing.
 */
export async function StudioChrome({ children }: { children: ReactNode }) {
  const [menu, themes] = await Promise.all([store.getMenu("main"), store.listThemes()]);
  return (
    <div className="relative isolate">
      <div className="pointer-events-none select-none">
        <SiteHeader nav={menuToNav(menu)} themes={themes.map((t) => ({ name: t.name, label: t.label }))} inert />
      </div>
      <main className="cg-main">
        <div className="cg-container">
          <article className="cg-page">{children}</article>
        </div>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter>
          <FooterContent />
        </SiteFooter>
      </div>
    </div>
  );
}
